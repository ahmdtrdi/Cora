import type { ServerWebSocket } from 'bun';
import type {
  GameState,
  WsMessage,
  CharacterState,
  GameStatus,
  MatchResult,
} from '@shared/websocket';
import { GameEngine } from '@cora/game-logic';
import { loadQuestions } from '../questions';

interface RoomClient {
  ws: ServerWebSocket<unknown> | null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null;
}

interface ServerPlayerMeta {
  hasDeposited: boolean;
}

export interface Room {
  id: string;
  clients: Map<string, RoomClient>;
  status: GameStatus;
  playerMeta: Map<string, ServerPlayerMeta>;
  engine: GameEngine | null;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private matchmakingQueue: Array<{ address: string; resolve: (roomId: string) => void }> = [];
  private DISCONNECT_TIMEOUT_MS = 10000; // 10 seconds

  // Returns the room if it exists, otherwise creates a new one
  public createRoom(roomId: string): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const newRoom: Room = {
      id: roomId,
      clients: new Map(),
      status: 'waiting',
      playerMeta: new Map(),
      engine: null,
    };
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // True FIFO matchmaking: pairs two players and returns a shared roomId
  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    // Check if there is another player in queue who isn't the same address
    const index = this.matchmakingQueue.findIndex((q) => q.address !== address);

    if (index !== -1) {
      // Pair found!
      const pairedPlayer = this.matchmakingQueue.splice(index, 1)[0];
      const newRoomId = `room-${Date.now()}`;
      this.createRoom(newRoomId);

      // Resolve for the waiting player
      pairedPlayer.resolve(newRoomId);
      // Resolve for current player
      return newRoomId;
    }

    // No pair found, enter queue
    return new Promise((resolve) => {
      const queueItem = { address, resolve };
      this.matchmakingQueue.push(queueItem);

      if (signal) {
        signal.addEventListener('abort', () => {
          const qIndex = this.matchmakingQueue.indexOf(queueItem);
          if (qIndex !== -1) {
            this.matchmakingQueue.splice(qIndex, 1);
            console.log(`Player ${address} aborted matchmaking request.`);
          }
        });
      }
    });
  }

  public joinRoom(roomId: string, address: string, ws: ServerWebSocket<unknown>) {
    const room = this.rooms.get(roomId);
    if (!room) {
      console.warn(`Room ${roomId} not found for join.`);
      return;
    }

    const client = room.clients.get(address);

    if (client) {
      // Reconnect
      console.log(`Player ${address} reconnected to room ${roomId}`);
      if (client.disconnectTimeout) {
        clearTimeout(client.disconnectTimeout);
        client.disconnectTimeout = null;
      }
      client.ws = ws;
    } else {
      // New join
      if (room.clients.size >= 2) {
        console.warn(`Room ${roomId} is full.`);
        ws.close(1008, 'Room is full');
        return;
      }

      console.log(`Player ${address} joined room ${roomId}`);
      room.clients.set(address, {
        ws,
        disconnectTimeout: null,
      });

      room.playerMeta.set(address, {
        hasDeposited: false,
      });
    }

    // Check if we can start depositing
    if (room.status === 'waiting' && room.clients.size === 2) {
      room.status = 'depositing';
      console.log(`Room ${roomId} has 2 players. Transitioning to depositing!`);
    }

    this.broadcastGameState(room);
  }

  public leaveRoom(roomId: string, address: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const client = room.clients.get(address);
    if (client) {
      console.log(`Player ${address} disconnected from room ${roomId}. Starting 10s timeout.`);
      client.ws = null;

      client.disconnectTimeout = setTimeout(() => {
        console.log(`Player ${address} forfeit room ${roomId} due to timeout.`);
        this.forfeitMatch(roomId, address);
      }, this.DISCONNECT_TIMEOUT_MS);
    }
  }

  public handleMessage(roomId: string, address: string, message: WsMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (message.type === 'confirmDeposit') {
      this.handleDeposit(room, address, message.payload?.signature);
    }

    if (message.type === 'playCard' && room.status === 'playing') {
      this.handlePlayCard(room, address, message.payload);
    }
  }

  // ─── Deposit Handling ─────────────────────────────────────────

  private handleDeposit(room: Room, address: string, signature: string) {
    console.log(`Player ${address} confirmed deposit with signature ${signature} in room ${room.id}`);

    const meta = room.playerMeta.get(address);
    if (meta) {
      meta.hasDeposited = true;
    }

    // Check if both players have deposited
    const allDeposited = Array.from(room.playerMeta.values()).every(p => p.hasDeposited);
    if (allDeposited && room.status === 'depositing') {
      room.status = 'playing';
      console.log(`Room ${room.id} both players deposited. Initializing game engine!`);
      this.initializeEngine(room);
    }
  }

  // ─── Engine Initialization ────────────────────────────────────

  private initializeEngine(room: Room) {
    const addresses = Array.from(room.clients.keys()) as [string, string];
    const questions = loadQuestions();

    if (questions.length === 0) {
      console.error(`No questions loaded! Cannot start match in room ${room.id}.`);
      return;
    }

    const engine = new GameEngine(addresses, questions);
    room.engine = engine;

    // Wire engine events to WebSocket broadcasts
    engine.on('timerSync', (data) => {
      this.broadcastToRoom(room, {
        type: 'timerSync',
        payload: engine.getTimerState(),
      });
    });

    engine.on('phaseChange', (data) => {
      console.log(`Room ${room.id} entering EXTRA POINT phase!`);
      this.broadcastToRoom(room, {
        type: 'phaseChange',
        payload: data.phase,
      });
      // Also send full state update so FE has consistent data
      this.broadcastGameState(room);
    });

    engine.on('gameOver', (data) => {
      console.log(`Room ${room.id} game over! Winner: ${data.winnerAddress} (${data.reason})`);
      room.status = 'finished';

      const result: MatchResult = {
        winnerAddress: data.winnerAddress,
        reason: data.reason,
        finalScores: engine.getScores(),
        finalHealth: engine.getHealth(),
      };

      this.broadcastToRoom(room, {
        type: 'matchResult',
        payload: result,
      });

      // Final state update
      this.broadcastGameState(room);
    });

    engine.on('stateUpdate', () => {
      this.broadcastGameState(room);
    });

    // Start the engine timer
    engine.start();
    console.log(`Room ${room.id} game engine started. 5-minute countdown begins!`);

    // Initial state broadcast
    this.broadcastGameState(room);
  }

  // ─── Card Play Handling ───────────────────────────────────────

  private handlePlayCard(room: Room, address: string, payload: any) {
    if (!room.engine || !room.engine.isActive()) return;

    const { cardId, selectedOptionId } = payload;
    console.log(`Player ${address} played card ${cardId} with answer ${selectedOptionId} in room ${room.id}`);

    const result = room.engine.playCard(address, cardId, selectedOptionId);

    if (!result.success) {
      console.warn(`Card play failed for ${address} in room ${room.id}`);
      return;
    }

    // Broadcast the damage/heal event for FE animations
    if (result.correct) {
      this.broadcastToRoom(room, {
        type: 'damageEvent',
        payload: {
          attackerAddress: result.attackerAddress,
          targetAddress: result.targetAddress,
          damage: result.cardType === 'attack' ? result.damage : result.heal,
          multiplier: result.multiplier,
          type: result.cardType,
          timestamp: Date.now(),
        },
      });
    }

    // Broadcast play result to the player who played
    const client = room.clients.get(address);
    if (client?.ws) {
      client.ws.send(JSON.stringify({
        type: 'playCardResult',
        payload: {
          correct: result.correct,
          damage: result.damage,
          heal: result.heal,
          multiplier: result.multiplier,
          cardType: result.cardType,
        },
      }));
    }

    // State update is handled by engine's stateUpdate event
  }

  // ─── Forfeit ──────────────────────────────────────────────────

  private forfeitMatch(roomId: string, disconnectedAddress: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';

    if (room.engine) {
      room.engine.stop(disconnectedAddress);
    } else {
      // Game hadn't started yet — just notify the remaining player
      const opponentAddress = Array.from(room.clients.keys()).find(a => a !== disconnectedAddress);
      if (opponentAddress) {
        const result: MatchResult = {
          winnerAddress: opponentAddress,
          reason: 'forfeit',
          finalScores: {},
          finalHealth: {},
        };
        this.broadcastToRoom(room, {
          type: 'matchResult',
          payload: result,
        });
      }
    }

    // Clean up room
    this.rooms.delete(roomId);
  }

  // ─── Broadcasting ─────────────────────────────────────────────

  private broadcastGameState(room: Room) {
    const addresses = Array.from(room.clients.keys());

    for (const address of addresses) {
      const client = room.clients.get(address);
      if (!client?.ws) continue;

      let payload: GameState;

      if (room.engine && (room.status === 'playing' || room.status === 'finished')) {
        // Engine owns the game state
        payload = room.engine.getStateForPlayer(address);
      } else {
        // Pre-game state (waiting / depositing)
        const opponentAddress = addresses.find(a => a !== address);
        payload = {
          status: room.status,
          player: {
            address,
            baseHealth: 100,
            characterState: 'stay',
            score: 0,
          },
          opponent: opponentAddress
            ? {
                address: opponentAddress,
                baseHealth: 100,
                characterState: 'stay',
                score: 0,
              }
            : {
                address: 'Waiting for opponent...',
                baseHealth: 100,
                characterState: 'stay',
                score: 0,
              },
          hand: [],
          timer: {
            totalDurationMs: GameEngine.MATCH_DURATION_MS,
            remainingMs: GameEngine.MATCH_DURATION_MS,
            phase: 'normal',
            extraPointThresholdMs: GameEngine.EXTRA_POINT_THRESHOLD_MS,
          },
          damageLog: [],
        };
      }

      client.ws.send(JSON.stringify({
        type: 'gameStateUpdate',
        payload,
      } as WsMessage<GameState>));
    }
  }

  /**
   * Broadcast a message to all connected clients in a room.
   */
  private broadcastToRoom(room: Room, message: WsMessage) {
    const raw = JSON.stringify(message);
    for (const client of room.clients.values()) {
      if (client.ws) {
        client.ws.send(raw);
      }
    }
  }
}
