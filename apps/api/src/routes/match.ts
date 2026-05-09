import { Hono } from 'hono';
import type { WSEvents } from 'hono/ws';
import type { WsMessage } from '@shared/websocket';
import { RoomManager } from '../managers/RoomManager';
import { resolveTokenMint } from '../config/tokens';

export function createMatchRouter(roomManager: RoomManager) {
  const router = new Hono();

  router.post('/', async (c) => {
    let address: string;
    try {
      const body = await c.req.json();
      address = body.address;
    } catch {
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

  router.get('/active/:address', (c) => {
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

  router.get('/presence/:address', (c) => {
    const address = c.req.param('address');
    const room = roomManager.queue.findActiveRoomForAddress(address);

    if (room) {
      const role =
        room.playerA === address ? 'playerA' :
        room.playerB === address ? 'playerB' :
        undefined;

      return c.json({
        inRoom: true,
        queued: false,
        roomId: room.id,
        role,
        roomType: room.roomType,
        status: room.status,
      });
    }

    return c.json({
      inRoom: false,
      queued: roomManager.queue.isQueued(address),
    });
  });

  // Private room creation for Blinks / direct challenge invites.
  // tokenMint and wagerAmount are stored server-side; never exposed in the Blink URL.
  router.post('/private', async (c) => {
    let address: string;
    let rawTokenMint: string;
    let wagerAmount: number;

    try {
      const body = await c.req.json();
      address = body.address;
      rawTokenMint = body.tokenMint;
      wagerAmount = body.wagerAmount;
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }

    if (!address || !rawTokenMint || !wagerAmount) {
      return c.json({ error: 'address, tokenMint, and wagerAmount are required' }, 400);
    }

    const tokenMint = resolveTokenMint(rawTokenMint);
    if (!tokenMint) {
      return c.json({ error: `Unknown token "${rawTokenMint}" - provide a symbol (SOL, BONK, USDC) or a valid mint address.` }, 400);
    }

    const roomId = roomManager.createPrivateRoom(address, tokenMint, BigInt(wagerAmount));

    const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 8080}`;
    const blinkUrl = `${baseUrl}/api/actions/challenge?roomId=${roomId}`;

    return c.json({ roomId, blinkUrl, role: 'playerA', roomType: 'private' });
  });

  return router;
}

export function createApiMatchRouter(roomManager: RoomManager) {
  const router = new Hono();

  router.get('/:roomId/proof', (c) => {
    const roomId = c.req.param('roomId');
    const room = roomManager.getRoom(roomId);
    if (!room?.erProofMeta) {
      return c.json({ error: 'No ER session for this match' }, 404);
    }

    return c.json({
      erSessionPda: room.erProofMeta.sessionPda,
      explorerUrl: `https://explorer.solana.com/address/${room.erProofMeta.sessionPda}?cluster=devnet`,
      erEnabled: room.erEnabled,
      status: room.erProofMeta.status ?? room.erLifecycleStatus,
      winner: room.erProofMeta.winner,
      setupTxSignatures: room.erProofMeta.setupTxSignatures,
      terminalTxSignatures: room.erProofMeta.terminalTxSignatures,
      endReason: room.erProofMeta.endReason,
    });
  });

  return router;
}

export function createMatchSocketRoute(roomManager: RoomManager) {
  return (roomId: string | undefined, address: string | undefined, characterId: string): WSEvents => {
    if (!roomId || !address) {
      return {
        onOpen(_event, ws) {
          ws.close(1008, 'RoomId and Address are required');
        },
      };
    }

    return {
      onOpen(_event, ws) {
        roomManager.joinRoom(roomId, address, ws, characterId);
      },
      onMessage(event) {
        try {
          const parsed = JSON.parse(event.data.toString()) as WsMessage;
          roomManager.handleMessage(roomId, address, parsed);
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      },
      onClose(_event, ws) {
        roomManager.leaveRoom(roomId, address, ws);
      },
    };
  };
}
