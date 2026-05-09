import { Hono } from 'hono';
import { PublicKey } from '@solana/web3.js';
import { RoomManager } from '../managers/RoomManager';
import { BlinkTransactionBuilder } from '../services/BlinkTransactionBuilder';
import { resolveTokenMint } from '../config/tokens';

export function createActionsRouter(roomManager: RoomManager) {
  const router = new Hono();

  // ---------------------------------------------------------------------------
  // Solana Actions & Blinks Middleware
  // Spec: https://solana.com/docs/advanced/actions#options-response
  // All Action endpoints MUST return these CORS headers for GET, POST & OPTIONS.
  // ---------------------------------------------------------------------------
  router.use('/*', async (c, next) => {
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    c.header(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, Content-Encoding, Accept-Encoding, X-Action-Version, X-Blockchain-Ids',
    );
    c.header('Access-Control-Expose-Headers', 'X-Action-Version, X-Blockchain-Ids');
    c.header('X-Action-Version', '2.1.3');
    c.header('X-Blockchain-Ids', 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'); // Solana Devnet

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }

    await next();
  });

  // ---------------------------------------------------------------------------
  // GET /api/actions/challenge — Action metadata (renders the Blink on X)
  //
  // If ?roomId is provided, validates the room state and returns contextual metadata.
  // If no roomId, returns the generic public matchmaking Blink.
  // ---------------------------------------------------------------------------
  router.get('/challenge', (c) => {
    const roomId = c.req.query('roomId');
    const iconUrl = 'https://arweave.net/qN7Xy_CgGf2Y-DItf-Bf0iV9Wl80S-c4m2rV6Q5S3j0';

    if (roomId) {
      const room = roomManager.getRoom(roomId);

      if (!room || room.status === 'finished') {
        return c.json({ error: { message: 'Challenge canceled — this room no longer exists.' } }, 400);
      }
      if (room.playerB !== null) {
        return c.json({ error: { message: 'Challenge already accepted — this match is full.' } }, 400);
      }

      // Valid open room — return a targeted Blink
      return c.json({
        type: 'action' as const,
        icon: iconUrl,
        title: 'CORA — Accept the Challenge ⚔️',
        description:
          'Your opponent is waiting! Deposit your wager and join the battle. ' +
          '97.5% to the winner — powered by Solana.',
        label: 'Accept & Deposit',
        links: {
          actions: [
            {
              type: 'transaction' as const,
              label: 'Accept Challenge',
              href: `/api/actions/challenge?roomId=${roomId}`,
            },
          ],
        },
      });
    }

    // Generic public matchmaking Blink (no roomId)
    return c.json({
      type: 'action' as const,
      icon: iconUrl,
      title: 'CORA — Challenge Me ⚔️',
      description:
        'Wager your tokens in a high-stakes aptitude battle! ' +
        'Match instantly, prove your logic skills, and take the pot. ' +
        '97.5% to the winner — powered by Solana.',
      label: 'Deposit & Play',
      links: {
        actions: [
          {
            type: 'transaction' as const,
            label: 'Stake 5 USDC',
            href: '/api/actions/challenge?amount=5',
          },
          {
            type: 'transaction' as const,
            label: 'Stake 10 USDC',
            href: '/api/actions/challenge?amount=10',
          },
          {
            type: 'transaction' as const,
            label: 'Stake 25 USDC',
            href: '/api/actions/challenge?amount=25',
          },
          {
            type: 'transaction' as const,
            label: 'Custom Stake',
            href: '/api/actions/challenge?amount={amount}',
            parameters: [
              {
                type: 'number' as const,
                name: 'amount',
                label: 'Enter stake amount (USDC)',
                required: true,
                min: 1,
                max: 1000,
                patternDescription: 'Enter a number between 1 and 1000',
              },
            ],
          },
        ],
      },
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/actions/challenge — Build unsigned Solana transaction (base64)
  // ---------------------------------------------------------------------------
  router.post('/challenge', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const account: string | undefined = body.account;
      const roomId = c.req.query('roomId');

      if (!account) {
        return c.json(
          { message: 'Missing `account` in POST body (base58 public key)' } satisfies ActionError,
          400,
        );
      }

      if (!roomId) {
        return c.json(
          { message: 'Missing `roomId` query parameter. Use POST /match/private to create a room first.' } satisfies ActionError,
          400,
        );
      }

      const room = roomManager.getRoom(roomId)!;
      if (!room) {
        return c.json({ message: 'Challenge canceled — this room no longer exists.' } satisfies ActionError, 404);
      }

      // Allow frontend to populate missing tokenMint and wagerAmount for public matchmaking
      if (room.roomType === 'public' && room.tokenMint === null && body.tokenMint) {
        const resolved = resolveTokenMint(body.tokenMint);
        if (!resolved) {
          return c.json({ message: `Unknown token "${body.tokenMint}" — provide a symbol (SOL, BONK, USDC) or a valid mint address.` } satisfies ActionError, 400);
        }
        room.tokenMint = resolved;
      }
      if (room.roomType === 'public' && room.wagerAmount === null && body.wagerAmount !== undefined) {
        room.wagerAmount = BigInt(body.wagerAmount);
      }

      // Check if user is already in the room
      const isPlayerA = room.playerA === account;
      const isPlayerB = room.playerB === account;

      // If not already in the room, try to join as Player B (Blink flow)
      if (!isPlayerA && !isPlayerB) {
        const joinResult = roomManager.joinPrivateRoom(account, roomId);
        if (joinResult === 'not_found') {
          return c.json({ message: 'Challenge canceled — this room no longer exists.' } satisfies ActionError, 404);
        }
        if (joinResult === 'cancelled') {
          return c.json({ message: 'Challenge canceled — the deposit window has expired.' } satisfies ActionError, 410);
        }
        if (joinResult === 'full') {
          return c.json({ message: 'Challenge already accepted — this match is full.' } satisfies ActionError, 409);
        }
      }

      if (!room.tokenMint || room.wagerAmount === null) {
        return c.json({ message: 'Internal error — room is missing token configuration.' } satisfies ActionError, 500);
      }

      // Validate that account and tokenMint are valid base58 public keys
      try {
        new PublicKey(account);
      } catch {
        return c.json({ message: 'Invalid `account` — not a valid base58 public key.' } satisfies ActionError, 400);
      }
      try {
        new PublicKey(room.tokenMint);
      } catch {
        return c.json({ message: 'Internal error — room has an invalid tokenMint.' } satisfies ActionError, 500);
      }

      // Delegate transaction building to the Builder service
      const base64 = await BlinkTransactionBuilder.buildDepositTransaction(account, room, isPlayerA);

      return c.json({
        transaction: base64,
        message: 'Sign to deposit your wager and join the CORA battle!',
      });
    } catch (err) {
      console.error('[actions/challenge POST] Failed to build transaction', err);
      return c.json(
        { message: 'Internal error — failed to build transaction' } satisfies ActionError,
        500,
      );
    }
  });

  return router;
}

interface ActionError {
  message: string;
}
