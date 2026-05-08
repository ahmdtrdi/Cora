import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createBunWebSocket } from 'hono/bun';
import type { ServerWebSocket } from 'bun';
import type { WsMessage } from '@shared/websocket';
import { PublicKey } from '@solana/web3.js';
import { RoomManager } from './managers/RoomManager';
import { rateLimiter } from './middleware/rateLimiter';
import { createActionsRouter } from './routes/actions';
import { startEventListener } from './utils/eventListener';
import { getArenaHistory, getWalletHistory, getWalletPlayability } from './services/goldrush';
import { supabase } from './services/supabase';

const { upgradeWebSocket, websocket } = createBunWebSocket<unknown>();
const app = new Hono();
const roomManager = new RoomManager();
const actionsRouter = createActionsRouter(roomManager);

// Global Middlewares
app.use('/*', cors()); // Enable CORS for all routes (frontend communication)
app.use('/*', rateLimiter); // Basic in-memory rate limiting

// Solana Blink Discovery
app.get('/actions.json', (c) => {
  // Required by X/Twitter and Wallets to discover Actions on this domain
  c.header('Access-Control-Allow-Origin', '*');
  c.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Encoding, Accept-Encoding');
  
  return c.json({
    rules: [
      {
        pathPattern: "/api/actions/*",
        apiPath: "/api/actions/*"
      }
    ]
  });
});

// Mounted Routers
app.route('/api/actions', actionsRouter);

// Basic health check route
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Goldrush History & Wallet Inspection Routes
app.get('/api/history/arena/:arenaId', async (c) => {
  const arenaId = c.req.param('arenaId');
  const history = await getArenaHistory(arenaId);
  return c.json({ items: history });
});

app.get('/api/history/wallet/:address', async (c) => {
  const address = c.req.param('address');
  const history = await getWalletHistory(address);
  return c.json({ items: history });
});

app.get('/api/history/wallet/:address/playability', async (c) => {
  const address = c.req.param('address');
  const arena = c.req.query('arena') || 'unknown';
  const token = c.req.query('token') || 'SOL';
  
  const playability = await getWalletPlayability(address, arena, token);
  return c.json(playability);
});

// Questions route
// app.get('/api/questions', async (c) => {
//   try {
//     const defaultPath = 'data/questions/pool.json';
//     const fallbackPath = '../../data/questions/pool.json';

//     let questions;
//     try {
//       questions = await Bun.file(defaultPath).json();
//     } catch {
//       questions = await Bun.file(fallbackPath).json();
//     }

//     // Serve 5 random questions
//     const shuffled = questions.sort(() => 0.5 - Math.random());
//     const selected = shuffled.slice(0, 5);

//     return c.json({ questions: selected });
//   } catch (error) {
//     console.error('Failed to load questions:', error);
//     return c.json({ error: 'Failed to load questions' }, 500);
//   }
// });

app.get('/api/questions', async (c) => {
  try {
    // Call the new distributed RPC function
    // Notice we don't need to pass a limit anymore because the SQL handles the 3-3-4 split natively
    const { data: selected, error } = await supabase.rpc('get_distributed_questions');

    if (error) {
      console.error('Supabase RPC Error:', error);
      throw error;
    }

    // Return the perfectly balanced, shuffled array of 10 questions
    return c.json({ questions: selected });
  } catch (error) {
    console.error('Failed to load questions from Supabase:', error);
    return c.json({ error: 'Failed to load questions' }, 500);
  }
});

// Matchmaking route
app.post('/match', async (c) => {
  let address: string;
  try {
    const body = await c.req.json();
    address = body.address;
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!address) {
    return c.json({ error: 'Address is required' }, 400);
  }

  const existingRoom = roomManager.queue.findActiveRoomForAddress(address);
  const roomId = await roomManager.queueMatch(address, c.req.raw.signal);
  const room = roomManager.getRoom(roomId);
  const role =
    room?.playerA === address ? 'playerA' :
    room?.playerB === address ? 'playerB' :
    undefined;

  return c.json({
    roomId,
    role,
    roomType: room?.roomType,
    alreadyInRoom: Boolean(existingRoom),
    status: room?.status,
  });
});

app.get('/match/active/:address', (c) => {
  const address = c.req.param('address');
  const room = roomManager.queue.findActiveRoomForAddress(address);

  if (!room) {
    return c.json({ inRoom: false });
  }

  const role =
    room.playerA === address ? 'playerA' :
    room.playerB === address ? 'playerB' :
    undefined;

  return c.json({
    inRoom: true,
    roomId: room.id,
    role,
    roomType: room.roomType,
    status: room.status,
    playerA: room.playerA,
    playerB: room.playerB,
  });
});

// Private room creation — for Blinks / direct challenge invites
// tokenMint and wagerAmount are stored server-side; never exposed in the Blink URL

// Map UI token symbols → on-chain SPL mint addresses (devnet)
const TOKEN_MINTS: Record<string, string> = {
  SOL:  'So11111111111111111111111111111111111111112',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  USDC: 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr',
};

function resolveTokenMint(input: string): string | null {
  const mapped = TOKEN_MINTS[input.toUpperCase()];
  if (mapped) return mapped;
  try {
    new PublicKey(input);
    return input;
  } catch {
    return null;
  }
}

app.post('/match/private', async (c) => {
  let address: string;
  let rawTokenMint: string;
  let wagerAmount: number;

  try {
    const body = await c.req.json();
    address = body.address;
    rawTokenMint = body.tokenMint;
    wagerAmount = body.wagerAmount;
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  if (!address || !rawTokenMint || !wagerAmount) {
    return c.json({ error: 'address, tokenMint, and wagerAmount are required' }, 400);
  }

  const tokenMint = resolveTokenMint(rawTokenMint);
  if (!tokenMint) {
    return c.json({ error: `Unknown token "${rawTokenMint}" — provide a symbol (SOL, BONK, USDC) or a valid mint address.` }, 400);
  }

  const roomId = roomManager.createPrivateRoom(address, tokenMint, BigInt(wagerAmount));

  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
  const blinkUrl = `${baseUrl}/api/actions/challenge?roomId=${roomId}`;

  return c.json({ roomId, blinkUrl, role: 'playerA', roomType: 'private' });
});

// Battle session fairness proof (ER session PDA + Solana Explorer link)
app.get('/api/match/:roomId/proof', (c) => {
  const roomId = c.req.param('roomId');
  const room = roomManager.getRoom(roomId);
  if (!room?.erSessionPda) {
    return c.json({ error: 'No ER session for this match' }, 404);
  }
  return c.json({
    erSessionPda: room.erSessionPda,
    explorerUrl: `https://explorer.solana.com/address/${room.erSessionPda}?cluster=devnet`,
  });
});

// WebSocket match route
app.get('/match/:roomId', upgradeWebSocket((c) => {
  const roomId = c.req.param('roomId');
  const address = c.req.query('address');
  const characterId = c.req.query('characterId') || 'einstein'; // Default if not provided

  if (!roomId || !address) {
    return {
      onOpen(event, ws) {
        ws.close(1008, 'RoomId and Address are required');
      }
    };
  }

  return {
    onOpen(event, ws: any) {
      roomManager.joinRoom(roomId, address, ws, characterId);
    },
    onMessage(event: MessageEvent) {
      try {
        const parsed = JSON.parse(event.data.toString()) as WsMessage;
        roomManager.handleMessage(roomId, address, parsed);
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    },
    onClose(event, ws: any) {
      roomManager.leaveRoom(roomId, address, ws);
    }
  };
}));

// Start the server
const port = parseInt(process.env.PORT || '8080', 10);
console.log(`Server is running on port ${port}`);

// Start Anchor event listener when RPC is configured
if (process.env.SOLANA_RPC_URL) {
  startEventListener(process.env.SOLANA_RPC_URL, process.env.SOLANA_WS_URL);
} else {
  console.log('[EventListener] Skipped — no SOLANA_RPC_URL configured.');
}

export default {
  port,
  fetch: app.fetch,
  websocket,
};
