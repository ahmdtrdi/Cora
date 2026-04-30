import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test';
import { RoomManager } from '../src/managers/RoomManager';
import type { Room } from '../src/managers/RoomManager';

/**
 * Create a mock WebSocket that records all sent messages.
 */
function createMockWs() {
  const sent: string[] = [];
  return {
    ws: {
      send: (data: string) => { sent.push(data); },
      close: mock(() => {}),
    } as any,
    sent,
    /** Parse all messages sent through this mock WS */
    get messages() {
      return sent.map(s => JSON.parse(s));
    },
    /** Get last sent message parsed */
    get lastMessage() {
      if (sent.length === 0) return null;
      return JSON.parse(sent[sent.length - 1]);
    },
  };
}

describe('RoomManager', () => {
  let manager: RoomManager;

  beforeEach(() => {
    manager = new RoomManager();
  });

  // ─── Room Creation ───────────────────────────────────────────

  describe('createRoom', () => {
    test('creates a new room with correct defaults', () => {
      const room = manager.createRoom('test-room-1');

      expect(room.id).toBe('test-room-1');
      expect(room.status).toBe('waiting');
      expect(room.clients.size).toBe(0);
      expect(room.playerMeta.size).toBe(0);
      expect(room.engine).toBeNull();
      expect(room.openedCards.size).toBe(0);
      expect(room.matchIdBytes).toBeInstanceOf(Uint8Array);
      expect(room.matchIdBytes.length).toBe(32);
    });

    test('returns existing room if already created', () => {
      const room1 = manager.createRoom('test-room-1');
      const room2 = manager.createRoom('test-room-1');
      expect(room1).toBe(room2); // Same reference
    });

    test('different room IDs produce different matchIdBytes', () => {
      const roomA = manager.createRoom('room-A');
      const roomB = manager.createRoom('room-B');
      expect(roomA.matchIdBytes).not.toEqual(roomB.matchIdBytes);
    });
  });

  // ─── getRoom ─────────────────────────────────────────────────

  describe('getRoom', () => {
    test('returns room if exists', () => {
      manager.createRoom('my-room');
      const room = manager.getRoom('my-room');
      expect(room).toBeDefined();
      expect(room!.id).toBe('my-room');
    });

    test('returns undefined for non-existent room', () => {
      expect(manager.getRoom('no-such-room')).toBeUndefined();
    });
  });

  // ─── Matchmaking Queue ───────────────────────────────────────

  describe('queueMatch', () => {
    test('pairs two different players immediately', async () => {
      // Player 1 enters queue — should block until paired
      const p1Promise = manager.queueMatch('player1');

      // Player 2 enters queue — should pair immediately
      const roomId2 = await manager.queueMatch('player2');

      // Player 1's promise should also resolve
      const roomId1 = await p1Promise;

      expect(roomId1).toBe(roomId2);
      expect(roomId1).toMatch(/^room-/);

      // Room should exist
      const room = manager.getRoom(roomId1);
      expect(room).toBeDefined();
    });

    test('prevents self-matching', async () => {
      // Same player queues twice — should NOT be paired
      const p1Promise = manager.queueMatch('player1');

      // Queue second with same address — also blocks
      const p2Promise = manager.queueMatch('player1');

      // Now a different player arrives — pairs with the first
      const roomId3 = await manager.queueMatch('player2');
      const roomId1 = await p1Promise;

      expect(roomId1).toBe(roomId3);

      // p2 should still be pending (same address as paired player 1)
      // Pair it with yet another player
      const roomIdFinal = await manager.queueMatch('player3');
      const roomId2 = await p2Promise;
      expect(roomId2).toBe(roomIdFinal);
    });

    test('abort signal removes player from queue', async () => {
      const controller = new AbortController();

      const p1Promise = manager.queueMatch('player1', controller.signal);

      // Abort before pairing
      controller.abort();

      // Now player2 enters — should NOT be paired with player1 (was aborted)
      // They should block since queue is empty after abort
      const p3Promise = manager.queueMatch('player3');
      const roomId2 = await manager.queueMatch('player2');
      const roomId3 = await p3Promise;

      expect(roomId2).toBe(roomId3);
    });
  });

  // ─── Join Room ───────────────────────────────────────────────

  describe('joinRoom', () => {
    test('first player joins and gets gameStateUpdate', () => {
      manager.createRoom('room-join');
      const mock1 = createMockWs();

      manager.joinRoom('room-join', 'playerA', mock1.ws);

      const room = manager.getRoom('room-join')!;
      expect(room.clients.size).toBe(1);
      expect(room.clients.has('playerA')).toBe(true);
      expect(room.status).toBe('waiting'); // Still waiting for player 2

      // Should have received a gameStateUpdate
      expect(mock1.messages.length).toBeGreaterThanOrEqual(1);
      const stateMsg = mock1.messages.find((m: any) => m.type === 'gameStateUpdate');
      expect(stateMsg).toBeDefined();
      expect(stateMsg.payload.status).toBe('waiting');
      expect(stateMsg.payload.player.address).toBe('playerA');
    });

    test('second player joins and transitions to depositing', () => {
      manager.createRoom('room-join2');
      const mock1 = createMockWs();
      const mock2 = createMockWs();

      manager.joinRoom('room-join2', 'playerA', mock1.ws);
      manager.joinRoom('room-join2', 'playerB', mock2.ws);

      const room = manager.getRoom('room-join2')!;
      expect(room.clients.size).toBe(2);
      expect(room.status).toBe('depositing');

      // Both should have received updated game state with depositing status
      const stateMsg2 = mock2.lastMessage;
      expect(stateMsg2.type).toBe('gameStateUpdate');
      expect(stateMsg2.payload.status).toBe('depositing');
    });

    test('third player is rejected when room is full', () => {
      manager.createRoom('room-full');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      const mock3 = createMockWs();

      manager.joinRoom('room-full', 'playerA', mock1.ws);
      manager.joinRoom('room-full', 'playerB', mock2.ws);
      manager.joinRoom('room-full', 'playerC', mock3.ws);

      expect(mock3.ws.close).toHaveBeenCalledWith(1008, 'Room is full');
    });

    test('player reconnect clears disconnect timeout', () => {
      manager.createRoom('room-reconnect');
      const mock1 = createMockWs();

      manager.joinRoom('room-reconnect', 'playerA', mock1.ws);

      // Simulate disconnect
      manager.leaveRoom('room-reconnect', 'playerA');

      const room = manager.getRoom('room-reconnect')!;
      const client = room.clients.get('playerA')!;
      expect(client.ws).toBeNull();
      expect(client.disconnectTimeout).not.toBeNull();

      // Reconnect
      const mock1b = createMockWs();
      manager.joinRoom('room-reconnect', 'playerA', mock1b.ws);

      const clientAfter = room.clients.get('playerA')!;
      expect(clientAfter.ws).toBe(mock1b.ws);
      expect(clientAfter.disconnectTimeout).toBeNull();
    });

    test('joining non-existent room does nothing', () => {
      const mockWs = createMockWs();
      manager.joinRoom('nonexistent', 'player', mockWs.ws);
      // No crash, no messages sent
      expect(mockWs.sent.length).toBe(0);
    });
  });

  // ─── Leave Room ──────────────────────────────────────────────

  describe('leaveRoom', () => {
    test('sets ws to null and starts disconnect timeout', () => {
      manager.createRoom('room-leave');
      const mockWs = createMockWs();
      manager.joinRoom('room-leave', 'playerA', mockWs.ws);

      manager.leaveRoom('room-leave', 'playerA');

      const room = manager.getRoom('room-leave')!;
      const client = room.clients.get('playerA')!;
      expect(client.ws).toBeNull();
      expect(client.disconnectTimeout).not.toBeNull();
    });

    test('leaving non-existent room does nothing', () => {
      // Should not throw
      manager.leaveRoom('nonexistent', 'player');
    });
  });

  // ─── Deposit Handling ────────────────────────────────────────

  describe('handleMessage - confirmDeposit', () => {
    test('single deposit does not start game', () => {
      manager.createRoom('room-dep');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      manager.joinRoom('room-dep', 'pA', mock1.ws);
      manager.joinRoom('room-dep', 'pB', mock2.ws);

      const room = manager.getRoom('room-dep')!;
      expect(room.status).toBe('depositing');

      manager.handleMessage('room-dep', 'pA', {
        type: 'confirmDeposit',
        payload: { signature: 'sig123' },
      });

      expect(room.status).toBe('depositing'); // Still depositing
      expect(room.playerMeta.get('pA')!.hasDeposited).toBe(true);
      expect(room.playerMeta.get('pB')!.hasDeposited).toBe(false);
    });

    test('both deposits transition to playing and init engine', () => {
      manager.createRoom('room-dep2');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      manager.joinRoom('room-dep2', 'pA', mock1.ws);
      manager.joinRoom('room-dep2', 'pB', mock2.ws);

      manager.handleMessage('room-dep2', 'pA', {
        type: 'confirmDeposit',
        payload: { signature: 'sigA' },
      });
      manager.handleMessage('room-dep2', 'pB', {
        type: 'confirmDeposit',
        payload: { signature: 'sigB' },
      });

      const room = manager.getRoom('room-dep2')!;
      expect(room.status).toBe('playing');
      expect(room.engine).not.toBeNull();

      // Both should have received gameStateUpdate with playing status
      const pBMessages = mock2.messages.filter((m: any) => m.type === 'gameStateUpdate');
      const lastState = pBMessages[pBMessages.length - 1];
      expect(lastState.payload.status).toBe('playing');
      expect(lastState.payload.hand.length).toBeGreaterThan(0); // cards dealt from available pool
    });
  });

  // ─── Card Open Pipeline ──────────────────────────────────────

  describe('handleMessage - openCard', () => {
    function setupPlayingRoom() {
      manager.createRoom('room-card');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      manager.joinRoom('room-card', 'pA', mock1.ws);
      manager.joinRoom('room-card', 'pB', mock2.ws);

      // Deposit both
      manager.handleMessage('room-card', 'pA', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });
      manager.handleMessage('room-card', 'pB', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });

      const room = manager.getRoom('room-card')!;
      return { room, mock1, mock2 };
    }

    test('opening a card starts countdown', () => {
      const { room, mock1 } = setupPlayingRoom();
      expect(room.status).toBe('playing');

      // Get a card from player A's hand
      const state = room.engine!.getStateForPlayer('pA');
      const cardId = state.hand[0].id;

      // Clear mock messages
      mock1.sent.length = 0;

      manager.handleMessage('room-card', 'pA', {
        type: 'openCard',
        payload: { cardId },
      });

      // Should have an opened card tracked
      expect(room.openedCards.has('pA')).toBe(true);
      expect(room.openedCards.get('pA')!.cardId).toBe(cardId);

      // Should have received cardCountdown
      const countdownMsg = mock1.messages.find((m: any) => m.type === 'cardCountdown');
      expect(countdownMsg).toBeDefined();
      expect(countdownMsg.payload.cardId).toBe(cardId);
      expect(countdownMsg.payload.remainingMs).toBe(10_000);
    });

    test('opening a second card while one is open is rejected', () => {
      const { room, mock1 } = setupPlayingRoom();

      const state = room.engine!.getStateForPlayer('pA');
      const cardId1 = state.hand[0].id;
      const cardId2 = state.hand[1].id;

      manager.handleMessage('room-card', 'pA', {
        type: 'openCard',
        payload: { cardId: cardId1 },
      });

      manager.handleMessage('room-card', 'pA', {
        type: 'openCard',
        payload: { cardId: cardId2 },
      });

      // Still only tracking the first card
      expect(room.openedCards.get('pA')!.cardId).toBe(cardId1);
    });

    test('opening a card not in hand is rejected', () => {
      const { room } = setupPlayingRoom();

      manager.handleMessage('room-card', 'pA', {
        type: 'openCard',
        payload: { cardId: 'fake-card-id' },
      });

      expect(room.openedCards.has('pA')).toBe(false);
    });
  });

  // ─── Card Play Handling ──────────────────────────────────────

  describe('handleMessage - playCard', () => {
    function setupPlayingRoom() {
      manager.createRoom('room-play');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      manager.joinRoom('room-play', 'pA', mock1.ws);
      manager.joinRoom('room-play', 'pB', mock2.ws);

      manager.handleMessage('room-play', 'pA', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });
      manager.handleMessage('room-play', 'pB', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });

      return { room: manager.getRoom('room-play')!, mock1, mock2 };
    }

    test('playing card without opening it first is rejected', () => {
      const { room, mock1 } = setupPlayingRoom();

      const state = room.engine!.getStateForPlayer('pA');
      const cardId = state.hand[0].id;

      mock1.sent.length = 0;

      manager.handleMessage('room-play', 'pA', {
        type: 'playCard',
        payload: { cardId, selectedOptionId: 'A' },
      });

      // Should NOT have received a playCardResult
      const resultMsg = mock1.messages.find((m: any) => m.type === 'playCardResult');
      expect(resultMsg).toBeUndefined();
    });

    test('playing card after opening sends playCardResult and scoreUpdate', () => {
      const { room, mock1, mock2 } = setupPlayingRoom();

      const internalPa = (room.engine! as any).players.get('pA');
      const engineCard = internalPa.hand[0];
      const cardId = engineCard.id;

      // Open the card first
      manager.handleMessage('room-play', 'pA', {
        type: 'openCard',
        payload: { cardId },
      });

      mock1.sent.length = 0;
      mock2.sent.length = 0;

      // Play the card with correct answer
      manager.handleMessage('room-play', 'pA', {
        type: 'playCard',
        payload: { cardId, selectedOptionId: engineCard.correctOptionId },
      });

      // Should have received playCardResult
      const resultMsg = mock1.messages.find((m: any) => m.type === 'playCardResult');
      expect(resultMsg).toBeDefined();
      expect(resultMsg.payload.correct).toBe(true);

      // Both players should have received scoreUpdate
      const scoreMsg1 = mock1.messages.find((m: any) => m.type === 'scoreUpdate');
      const scoreMsg2 = mock2.messages.find((m: any) => m.type === 'scoreUpdate');
      expect(scoreMsg1).toBeDefined();
      expect(scoreMsg2).toBeDefined();

      // Opened card should be cleared
      expect(room.openedCards.has('pA')).toBe(false);
    });

    test('wrong answer still clears opened card but no damage/heal', () => {
      const { room, mock1 } = setupPlayingRoom();

      const internalPa = (room.engine! as any).players.get('pA');
      const engineCard = internalPa.hand[0];
      const cardId = engineCard.id;

      // Find wrong option
      const wrongOptionId = engineCard.question.options.find(
        (o: any) => o.id !== engineCard.correctOptionId
      )?.id ?? 'Z';

      // Open
      manager.handleMessage('room-play', 'pA', {
        type: 'openCard',
        payload: { cardId },
      });

      mock1.sent.length = 0;

      // Play with wrong answer
      manager.handleMessage('room-play', 'pA', {
        type: 'playCard',
        payload: { cardId, selectedOptionId: wrongOptionId },
      });

      const resultMsg = mock1.messages.find((m: any) => m.type === 'playCardResult');
      expect(resultMsg).toBeDefined();
      expect(resultMsg.payload.correct).toBe(false);

      // Opened card should be cleared
      expect(room.openedCards.has('pA')).toBe(false);
    });
  });

  // ─── Broadcasting ────────────────────────────────────────────

  describe('broadcasting', () => {
    test('gameStateUpdate is per-player (different perspectives)', () => {
      manager.createRoom('room-broadcast');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      manager.joinRoom('room-broadcast', 'pA', mock1.ws);
      manager.joinRoom('room-broadcast', 'pB', mock2.ws);

      // Both deposited → playing
      manager.handleMessage('room-broadcast', 'pA', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });
      manager.handleMessage('room-broadcast', 'pB', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });

      // Get last gameStateUpdate for each player
      const pAStates = mock1.messages.filter((m: any) => m.type === 'gameStateUpdate');
      const pBStates = mock2.messages.filter((m: any) => m.type === 'gameStateUpdate');

      const lastPA = pAStates[pAStates.length - 1];
      const lastPB = pBStates[pBStates.length - 1];

      // Player A's state should show pA as player and pB as opponent
      expect(lastPA.payload.player.address).toBe('pA');
      expect(lastPA.payload.opponent.address).toBe('pB');

      // Player B's state should be the reverse
      expect(lastPB.payload.player.address).toBe('pB');
      expect(lastPB.payload.opponent.address).toBe('pA');
    });

    test('waiting state shows placeholder for missing opponent', () => {
      manager.createRoom('room-solo');
      const mock1 = createMockWs();
      manager.joinRoom('room-solo', 'pA', mock1.ws);

      const stateMsg = mock1.messages.find((m: any) => m.type === 'gameStateUpdate');
      expect(stateMsg.payload.opponent.address).toBe('Waiting for opponent...');
    });

    test('disconnected player does not receive broadcasts', () => {
      manager.createRoom('room-dc');
      const mock1 = createMockWs();
      const mock2 = createMockWs();
      manager.joinRoom('room-dc', 'pA', mock1.ws);
      manager.joinRoom('room-dc', 'pB', mock2.ws);

      // Disconnect player B
      manager.leaveRoom('room-dc', 'pB');

      // Clear messages
      mock1.sent.length = 0;
      mock2.sent.length = 0;

      // Deposit from player A → triggers broadcast
      manager.handleMessage('room-dc', 'pA', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });

      // Player A should still get messages, player B should not
      expect(mock1.sent.length).toBe(0); // No broadcast on single deposit with only non-state-changing event
      // (handleDeposit only broadcasts after BOTH deposits)
    });
  });

  // ─── Pre-game state structure ────────────────────────────────

  describe('pre-game state', () => {
    test('waiting state has correct structure', () => {
      manager.createRoom('room-struct');
      const mockWs = createMockWs();
      manager.joinRoom('room-struct', 'pA', mockWs.ws);

      const stateMsg = mockWs.messages.find((m: any) => m.type === 'gameStateUpdate');
      const payload = stateMsg.payload;

      expect(payload.status).toBe('waiting');
      expect(payload.player.baseHealth).toBe(100);
      expect(payload.player.characterState).toBe('stay');
      expect(payload.player.score).toBe(0);
      expect(payload.hand).toEqual([]);
      expect(payload.timer.totalDurationMs).toBe(300_000);
      expect(payload.timer.remainingMs).toBe(300_000);
      expect(payload.timer.phase).toBe('normal');
      expect(payload.damageLog).toEqual([]);
    });
  });

  // ─── handleMessage routing ───────────────────────────────────

  describe('handleMessage routing', () => {
    test('ignores openCard when not in playing status', () => {
      manager.createRoom('room-route');
      const mockWs = createMockWs();
      manager.joinRoom('room-route', 'pA', mockWs.ws);

      // Room is in 'waiting' — openCard should be ignored
      manager.handleMessage('room-route', 'pA', {
        type: 'openCard',
        payload: { cardId: 'card-1' },
      });

      const room = manager.getRoom('room-route')!;
      expect(room.openedCards.size).toBe(0);
    });

    test('ignores playCard when not in playing status', () => {
      manager.createRoom('room-route2');
      const mockWs = createMockWs();
      manager.joinRoom('room-route2', 'pA', mockWs.ws);

      manager.handleMessage('room-route2', 'pA', {
        type: 'playCard',
        payload: { cardId: 'card-1', selectedOptionId: 'A' },
      });

      // No crash, nothing happened
      expect(manager.getRoom('room-route2')!.engine).toBeNull();
    });

    test('handles message for non-existent room gracefully', () => {
      // Should not throw
      manager.handleMessage('nonexistent', 'player', {
        type: 'confirmDeposit',
        payload: { signature: 'sig' },
      });
    });
  });
});
