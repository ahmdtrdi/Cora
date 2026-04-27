import { Hono } from 'hono';
import { createBunWebSocket } from 'hono/bun';
import type { GameState, WsMessage } from '@shared/websocket';

const { upgradeWebSocket, websocket } = createBunWebSocket();
const app = new Hono();

const initialGameState: GameState = {
  status: 'playing',
  currentRound: 1,
  player: {
    address: 'mock_player_123',
    baseHealth: 100,
    characterState: 'stay'
  },
  opponent: {
    address: 'mock_opponent_456',
    baseHealth: 100,
    characterState: 'stay'
  },
  hand: [
    {
      id: 'card-1',
      type: 'attack',
      question: {
        id: 'q-1',
        text: 'What is 5 + 5?',
        options: ['10', '15', '20']
      }
    },
    {
      id: 'card-2',
      type: 'heal',
      question: {
        id: 'q-2',
        text: 'If A -> B and B -> C, then...',
        options: ['A -> C', 'C -> A', 'A -> B -> A']
      }
    }
  ]
};

// Basic health check route
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// WebSocket match route
app.get('/match/:roomId', upgradeWebSocket((c) => {
  const roomId = c.req.param('roomId');
  console.log(`Client requested connection to room: ${roomId}`);
  
  return {
    onOpen(event, ws) {
      console.log(`Client connected to room: ${roomId}`);
      ws.send(JSON.stringify({
        type: 'gameStateUpdate',
        payload: initialGameState
      } as WsMessage<GameState>));
    },
    onMessage(event, ws) {
      try {
        const parsed = JSON.parse(event.data.toString()) as WsMessage;
        console.log('Received:', parsed);

        if (parsed.type === 'playCard') {
          const { cardId } = parsed.payload;
          
          // Mock a response 1 second later
          setTimeout(() => {
            console.log(`Responding to card ${cardId}...`);
            const nextState: GameState = JSON.parse(JSON.stringify(initialGameState)); // Deep copy
            nextState.opponent.baseHealth = 80;
            nextState.player.characterState = 'happy';
            nextState.hand = [initialGameState.hand[1]]; // Card was consumed
            
            ws.send(JSON.stringify({
              type: 'gameStateUpdate',
              payload: nextState
            } as WsMessage<GameState>));
          }, 1000);
        }
      } catch (e) {
        console.error('Failed to parse message', e);
      }
    },
    onClose() {
      console.log(`Client disconnected from room: ${roomId}`);
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
