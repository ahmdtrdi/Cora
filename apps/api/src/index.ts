import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import type { ServerWebSocket } from 'bun';
import type { WsMessage } from '@shared/websocket';
import { RoomManager } from './managers/RoomManager';

const { upgradeWebSocket, websocket } = createBunWebSocket<unknown>();
const app = new Hono();
const roomManager = new RoomManager();

// Basic health check route
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
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

  const roomId = await roomManager.queueMatch(address, c.req.raw.signal);
  return c.json({ roomId });
});

// WebSocket match route
app.get('/match/:roomId', upgradeWebSocket((c) => {
  const roomId = c.req.param('roomId');
  const address = c.req.query('address');

  if (!roomId || !address) {
    return {
      onOpen(event, ws) {
        ws.close(1008, 'RoomId and Address are required');
      }
    };
  }

  return {
    onOpen(event, ws: any) {
      roomManager.joinRoom(roomId, address, ws);
    },
    onMessage(event: MessageEvent) {
      try {
        const parsed = JSON.parse(event.data.toString()) as WsMessage;
        roomManager.handleMessage(roomId, address, parsed);
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    },
    onClose() {
      roomManager.leaveRoom(roomId, address);
    }
  };
}));

// Start the server
const port = parseInt(process.env.PORT || '8080', 10);
console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};
