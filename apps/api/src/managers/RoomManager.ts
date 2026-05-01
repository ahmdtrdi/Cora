import type { ServerWebSocket } from 'bun';
import type {
  GameState,
  WsMessage,
  CharacterState,
  GameStatus,
  MatchResult,
  Card,
  ScoreUpdateData,
  MatchFoundData,
} from '@shared/websocket';
import { GameEngine } from '@cora/game-logic';
import type { AntiCheatVerdict } from '@cora/game-logic';
import { loadQuestions } from '../questions';
import { deriveMatchId } from '@shared/escrow';
import { signSettlementAuthorization, serverPublicKey, submitSettlementTransaction } from '../utils/settlement';

interface RoomClient {
  ws: ServerWebSocket<unknown> | null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null;
}

interface ServerPlayerMeta {
  hasDeposited: boolean;
}

interface OpenedCard {
  cardId: string;
  openedAt: number;
  countdownInterval: ReturnType<typeof setInterval> | null;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
}

export interface Room {
  id: string;
  /** 32-byte match ID derived from room ID — used for on-chain PDA derivation */
  matchIdBytes: Uint8Array;
  clients: Map<string, RoomClient>;
  status: GameStatus;
  playerMeta: Map<string, ServerPlayerMeta>;
  engine: GameEngine | null;
  /** Tracks which card each player has currently opened (one at a time per player) */
  openedCards: Map<string, OpenedCard>;
  /** 'private' rooms are created via /match/private for Blinks; 'public' rooms come from the FIFO queue */
  roomType: 'public' | 'private';
  /** Role-assigned player addresses — set at pairing time, never from URL params */
  playerA: string | null;
  playerB: string | null;
  /** Whether Player B has been sent their deposit_wager transaction yet (sequential unlock) */
  playerBUnlocked: boolean;
  /** SPL token mint for this match — stored server-side, never derived from client input */
  tokenMint: string | null;
  /** Wager amount in token base units (e.g. USDC: 1 USDC = 1_000_000) */
  wagerAmount: bigint | null;
  /** Per-player 20s shot clocks during the deposit phase */
  depositTimeouts: Map<string, ReturnType<typeof setTimeout>>;
}

export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private matchmakingQueue: Array<{ address: string; ws?: ServerWebSocket<unknown>; resolve: (roomId: string) => void }> = [];
  private DISCONNECT_TIMEOUT_MS = 10_000;  // 10 seconds (only during 'playing')
  private DEPOSIT_TIMEOUT_MS = 20_000;     // 20 seconds per player during 'depositing'
  private CARD_ANSWER_TIMEOUT_MS = 10_000; // 10 seconds per card
  private CARD_COUNTDOWN_TICK_MS = 1_000;  // 1 second countdown tick

  // Returns the room if it exists, otherwise creates a new one
  public createRoom(roomId: string): Room {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    const newRoom: Room = {
      id: roomId,
      matchIdBytes: deriveMatchId(roomId),
      clients: new Map(),
      status: 'waiting',
      playerMeta: new Map(),
      engine: null,
      openedCards: new Map(),
      roomType: 'public',
      playerA: null,
      playerB: null,
      playerBUnlocked: false,
      tokenMint: null,
      wagerAmount: null,
      depositTimeouts: new Map(),
    };
    this.rooms.set(roomId, newRoom);
    return newRoom;
  }

  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  // ─── Private Room (Blinks / Direct Challenge) ──────────────────

  /**
   * Creates a private room for a Blink challenge.
   * Player A must sign initialize_match + deposit_wager.
   * tokenMint and wagerAmount are stored server-side — never taken from the URL.
   */
  public createPrivateRoom(
    playerAPubkey: string,
    tokenMint: string,
    wagerAmount: bigint,
  ): string {
    const roomId = `private-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const room: Room = {
      id: roomId,
      matchIdBytes: deriveMatchId(roomId),
      clients: new Map(),
      status: 'depositing',
      playerMeta: new Map([[playerAPubkey, { hasDeposited: false }]]),
      engine: null,
      openedCards: new Map(),
      roomType: 'private',
      playerA: playerAPubkey,
      playerB: null,
      playerBUnlocked: false,
      tokenMint,
      wagerAmount,
      depositTimeouts: new Map(),
    };
    this.rooms.set(roomId, room);
    console.log(`[Private] Room ${roomId} created for Player A: ${playerAPubkey}`);
    // Arm Player A's 20s shot clock immediately
    this.armDepositTimeout(room, playerAPubkey);
    return roomId;
  }

  /**
   * Joins a private room as Player B (Blink flow).
   * Returns a result code so the caller can return the correct HTTP response.
   */
  public joinPrivateRoom(
    playerBPubkey: string,
    roomId: string,
  ): 'ok' | 'not_found' | 'full' | 'cancelled' {
    const room = this.rooms.get(roomId);
    if (!room || room.roomType !== 'private') return 'not_found';
    if (room.status !== 'depositing') return 'cancelled';
    if (room.playerB !== null) return 'full';
    if (room.playerA === playerBPubkey) return 'full'; // same address

    room.playerB = playerBPubkey;
    room.playerMeta.set(playerBPubkey, { hasDeposited: false });
    console.log(`[Private] Player B ${playerBPubkey} joined room ${roomId}`);
    return 'ok';
  }

  /**
   * Cancels a depositing room (shot clock fired or hard disconnect).
   * Re-queues the innocent player at the front of the public matchmaking queue.
   */
  public cancelRoom(roomId: string, innocentAddress?: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`[Cancel] Room ${roomId} cancelled. Innocent: ${innocentAddress ?? 'none'}`);

    // Clear all deposit shot clocks
    for (const timer of room.depositTimeouts.values()) clearTimeout(timer);
    room.depositTimeouts.clear();

    // Notify and re-queue the innocent player if they are still WebSocket-connected
    if (innocentAddress) {
      const client = room.clients.get(innocentAddress);
      if (client?.ws) {
        client.ws.send(JSON.stringify({ type: 'opponentFailedDeposit', payload: {} } satisfies WsMessage));
      }
      // Re-queue at the front so they are matched next
      const queueItem = {
        address: innocentAddress,
        ws: client?.ws ?? undefined,
        resolve: (newRoomId: string) => {
          // When re-queued player is paired, notify them via their existing WS if still open
          const c = room.clients.get(innocentAddress);
          if (c?.ws) {
            c.ws.send(JSON.stringify({ type: 'matchFound', payload: { roomId: newRoomId, role: 'playerA', opponentAddress: '' } } satisfies WsMessage<MatchFoundData>));
          }
        },
      };
      this.matchmakingQueue.unshift(queueItem);
    }

    this.rooms.delete(roomId);
  }

  /**
   * Arms a 20-second deposit shot clock for the given player in the given room.
   * If they don't confirm in time, the room is cancelled and the other player is re-queued.
   */
  private armDepositTimeout(room: Room, address: string): void {
    // Clear any existing timer for this player first
    const existing = room.depositTimeouts.get(address);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      console.log(`[ShotClock] Player ${address} timed out in room ${room.id}. Cancelling.`);
      const opponentAddress = address === room.playerA ? room.playerB : room.playerA;
      this.cancelRoom(room.id, opponentAddress ?? undefined);
    }, this.DEPOSIT_TIMEOUT_MS);

    room.depositTimeouts.set(address, timer);
  }

  // True FIFO matchmaking: pairs two players and returns a shared roomId.
  // Phase 3: assigns playerA / playerB roles and uses the sequential deposit model.
  public async queueMatch(address: string, signal?: AbortSignal): Promise<string> {
    const index = this.matchmakingQueue.findIndex((q) => q.address !== address);

    if (index !== -1) {
      // Pair found — Player A is the waiting player (initializer), Player B is the incoming player
      const playerAEntry = this.matchmakingQueue.splice(index, 1)[0];
      const newRoomId = `room-${Date.now()}`;
      const room = this.createRoom(newRoomId);

      // Assign roles on the room
      room.playerA = playerAEntry.address;
      room.playerB = address;
      room.status = 'depositing';

      // Arm Player A's 20s shot clock
      this.armDepositTimeout(room, playerAEntry.address);

      // Resolve Player A's pending promise — the WS handler will emit MATCH_FOUND to them
      playerAEntry.resolve(newRoomId);

      // Return the roomId to Player B — their WS handler will emit MATCH_FOUND_WAITING
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
    if (!client) return;

    client.ws = null;

    if (room.status === 'playing') {
      // Only arm the 10s forfeit timer once the game is live
      console.log(`Player ${address} disconnected from room ${roomId}. Starting 10s forfeit timer.`);
      client.disconnectTimeout = setTimeout(() => {
        console.log(`Player ${address} forfeit room ${roomId} due to timeout.`);
        this.forfeitMatch(roomId, address);
      }, this.DISCONNECT_TIMEOUT_MS);
    } else if (room.status === 'depositing') {
      // Hard disconnect during deposit phase = immediate cancel; shot clock would fire anyway
      console.log(`Player ${address} disconnected during depositing in room ${roomId}. Cancelling.`);
      const opponent = address === room.playerA ? room.playerB : room.playerA;
      this.cancelRoom(roomId, opponent ?? undefined);
    }
  }

  public handleMessage(roomId: string, address: string, message: WsMessage) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (message.type === 'confirmDeposit') {
      this.handleDeposit(room, address, message.payload?.signature);
    }

    if (message.type === 'openCard' && room.status === 'playing') {
      this.handleOpenCard(room, address, message.payload?.cardId);
    }

    if (message.type === 'playCard' && room.status === 'playing') {
      this.handlePlayCard(room, address, message.payload);
    }
  }

  // ─── Deposit Handling ─────────────────────────────────────────

  private handleDeposit(room: Room, address: string, signature: string) {
    console.log(`Player ${address} confirmed deposit with signature ${signature} in room ${room.id}`);

    // Clear this player's deposit shot clock — they paid in time
    const timer = room.depositTimeouts.get(address);
    if (timer) {
      clearTimeout(timer);
      room.depositTimeouts.delete(address);
    }

    const meta = room.playerMeta.get(address);
    if (meta) meta.hasDeposited = true;

    const isPlayerA = address === room.playerA;

    // Sequential unlock: after A deposits, send depositUnlocked to B and arm their shot clock
    if (isPlayerA && !room.playerBUnlocked && room.playerB) {
      room.playerBUnlocked = true;
      const playerBClient = room.clients.get(room.playerB);
      if (playerBClient?.ws) {
        playerBClient.ws.send(JSON.stringify({
          type: 'depositUnlocked',
          payload: { roomId: room.id },
        } satisfies WsMessage));
      }
      this.armDepositTimeout(room, room.playerB);
      console.log(`Room ${room.id}: Player A deposited. Player B unlocked.`);
      return;
    }

    // Both players have now deposited — start the game
    const allDeposited = Array.from(room.playerMeta.values()).every(p => p.hasDeposited);
    if (allDeposited && room.status === 'depositing') {
      for (const t of room.depositTimeouts.values()) clearTimeout(t);
      room.depositTimeouts.clear();

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
      console.log('FINISHED: Winner determined server-side');
      room.status = 'finished';

      // --- Anti-Cheat Evaluation ---
      const verdicts = data.antiCheatVerdicts || {};
      let isRejected = false;
      let cheaterAddress: string | null = null;
      let isSuspicious = false;

      console.log(`[Anti-Cheat] Room ${room.id} verdicts:`);
      for (const [address, verdict] of Object.entries(verdicts)) {
        console.log(` - Player ${address}: ${verdict.verdict.toUpperCase()} (Score: ${verdict.trustScore.toFixed(2)})`);
        if (verdict.verdict === 'rejected') {
          isRejected = true;
          cheaterAddress = address; // Keep track of the cheater
          console.warn(`[Anti-Cheat] WARNING: Player ${address} was rejected for flags:`, verdict.flags.map(f => f.signal).join(', '));
        } else if (verdict.verdict === 'suspicious') {
          isSuspicious = true;
          console.warn(`[Anti-Cheat] WARNING: Player ${address} is suspicious. Flags:`, verdict.flags.map(f => f.signal).join(', '));
        }

        // Log raw stats for future ML collection
        console.log(`[Anti-Cheat] Stats for ${address}:`, JSON.stringify(verdict.stats));
      }

      if (isRejected && cheaterAddress) {
        console.error(`[Anti-Cheat] Match in Room ${room.id} REJECTED. Handling anti-cheat settlement.`);

        // Anti-cheat settlement: action = 1, target = cheaterAddress
        this.broadcastAntiCheatPenalty(room, cheaterAddress);

        const result: MatchResult = {
          winnerAddress: data.winnerAddress,
          reason: 'anti_cheat',
          finalScores: engine.getScores(),
          finalHealth: engine.getHealth(),
        };

        this.broadcastToRoom(room, {
          type: 'matchInvalidated',
          payload: result,
        });
      } else {
        const result: MatchResult = {
          winnerAddress: data.winnerAddress,
          reason: data.reason,
          finalScores: engine.getScores(),
          finalHealth: engine.getHealth(),
          antiCheatWarning: isSuspicious,
        };

        this.broadcastMatchResult(room, data.winnerAddress);
        this.broadcastToRoom(room, {
          type: 'matchResult',
          payload: result,
        });
      }

      // Final state update
      this.broadcastGameState(room);
    });

    engine.on('roundOver', (data) => {
      console.log(`Room ${room.id} round over. Winner: ${data.winnerAddress} (${data.reason})`);

      // Clear any opened cards to reset for the next round
      this.clearAllOpenedCards(room);

      this.broadcastToRoom(room, {
        type: 'roundOver',
        payload: {
          winnerAddress: data.winnerAddress,
          reason: data.reason
        }
      });
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

  // ─── Card Open & Countdown ────────────────────────────────────

  private handleOpenCard(room: Room, address: string, cardId: string) {
    if (!room.engine || !room.engine.isActive()) return;
    if (!cardId) return;

    // Only one card open at a time per player
    const existing = room.openedCards.get(address);
    if (existing) {
      console.warn(`Player ${address} already has card ${existing.cardId} open in room ${room.id}. Ignoring.`);
      return;
    }

    // Verify the card exists in the player's hand via engine state
    const playerState = room.engine.getStateForPlayer(address);
    const cardInHand = playerState.hand.find(c => c.id === cardId);
    if (!cardInHand) {
      console.warn(`Card ${cardId} not found in ${address}'s hand. Ignoring openCard.`);
      return;
    }

    const openedAt = Date.now();
    console.log(`Player ${address} opened card ${cardId} in room ${room.id}. 10s countdown started.`);

    // Send initial countdown immediately
    const client = room.clients.get(address);
    if (client?.ws) {
      client.ws.send(JSON.stringify({
        type: 'cardCountdown',
        payload: { cardId, remainingMs: this.CARD_ANSWER_TIMEOUT_MS },
      }));
    }

    // Countdown tick every 1 second
    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - openedAt;
      const remaining = Math.max(0, this.CARD_ANSWER_TIMEOUT_MS - elapsed);

      const c = room.clients.get(address);
      if (c?.ws) {
        c.ws.send(JSON.stringify({
          type: 'cardCountdown',
          payload: { cardId, remainingMs: remaining },
        }));
      }
    }, this.CARD_COUNTDOWN_TICK_MS);

    // Timeout: auto-expire the card after 10 seconds
    const timeoutHandle = setTimeout(() => {
      this.expireCard(room, address, cardId);
    }, this.CARD_ANSWER_TIMEOUT_MS);

    room.openedCards.set(address, {
      cardId,
      openedAt,
      countdownInterval,
      timeoutHandle,
    });
  }

  /**
   * Auto-expire a card when the countdown runs out.
   * Uses engine.playCard with an invalid option so the engine treats it as a
   * wrong answer: no damage, no heal, card consumed, new card dealt.
   */
  private expireCard(room: Room, address: string, cardId: string) {
    if (!room.engine || !room.engine.isActive()) return;

    console.log(`Card ${cardId} expired for player ${address} in room ${room.id} (timeout).`);

    // Clear tracking first to prevent double-processing
    this.clearOpenedCard(room, address);

    // Force-play with invalid option — engine treats as wrong answer
    room.engine.playCard(address, cardId, '__timeout__');

    // Notify the player that the card expired
    const client = room.clients.get(address);
    if (client?.ws) {
      client.ws.send(JSON.stringify({
        type: 'cardExpired',
        payload: { cardId },
      }));
    }

    // Broadcast live scores after expiry
    this.broadcastScoreUpdate(room);
  }

  // ─── Card Play Handling ───────────────────────────────────────

  private handlePlayCard(room: Room, address: string, payload: any) {
    if (!room.engine || !room.engine.isActive()) return;

    const { cardId, selectedOptionId } = payload;

    // Validate: card must have been opened first
    const opened = room.openedCards.get(address);
    if (!opened || opened.cardId !== cardId) {
      console.warn(`Player ${address} tried to play card ${cardId} without opening it first in room ${room.id}.`);
      return;
    }

    // Clear the countdown — player answered in time
    this.clearOpenedCard(room, address);

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

    // Broadcast live scores to both players
    this.broadcastScoreUpdate(room);

    // Reset character states after 1s animation
    setTimeout(() => {
      if (room.engine && room.engine.isActive()) {
        room.engine.resetCharacterStates();
      }
    }, 1000);
  }

  // ─── Opened Card Helpers ──────────────────────────────────────

  /**
   * Clear the countdown interval and timeout for a player's opened card.
   */
  private clearOpenedCard(room: Room, address: string) {
    const opened = room.openedCards.get(address);
    if (!opened) return;

    if (opened.countdownInterval) clearInterval(opened.countdownInterval);
    if (opened.timeoutHandle) clearTimeout(opened.timeoutHandle);
    room.openedCards.delete(address);
  }

  /**
   * Clear all opened cards in a room (used on game over / forfeit).
   */
  private clearAllOpenedCards(room: Room) {
    for (const address of room.openedCards.keys()) {
      this.clearOpenedCard(room, address);
    }
  }

  // ─── Forfeit ──────────────────────────────────────────────────

  private forfeitMatch(roomId: string, disconnectedAddress: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.status = 'finished';

    // Clear all opened card timers
    this.clearAllOpenedCards(room);

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
   * Broadcast live score update to both players after every card play or expiry.
   */
  private broadcastScoreUpdate(room: Room) {
    if (!room.engine) return;

    const scores = room.engine.getScores();
    const health = room.engine.getHealth();
    const addresses = Array.from(room.clients.keys());

    for (const address of addresses) {
      const client = room.clients.get(address);
      if (!client?.ws) continue;

      const opponentAddress = addresses.find(a => a !== address) ?? '';

      const scoreData: ScoreUpdateData = {
        playerAddress: address,
        opponentAddress,
        playerScore: scores[address] ?? 0,
        opponentScore: scores[opponentAddress] ?? 0,
        playerHealth: health[address] ?? 0,
        opponentHealth: health[opponentAddress] ?? 0,
      };

      client.ws.send(JSON.stringify({
        type: 'scoreUpdate',
        payload: scoreData,
      }));
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

  /**
   * Broadcast settlement-signed match result to all connected clients.
   */
  private broadcastMatchResult(room: Room, winnerAddress: string) {
    // Normal match outcome: action = 0
    const action = 0;
    const settlementSignature = signSettlementAuthorization(
      action,
      room.matchIdBytes,
      winnerAddress,
    );

    // Call oracle to automatically submit settlement on-chain
    submitSettlementTransaction(action, room.matchIdBytes, winnerAddress)
      .then(tx => console.log(`[RoomManager] On-chain settlement completed. Tx: ${tx}`))
      .catch(err => console.error(`[RoomManager] Auto-settlement failed:`, err));

    for (const client of room.clients.values()) {
      if (client.ws) {
        client.ws.send(JSON.stringify({
          type: 'matchResult',
          payload: {
            winner: winnerAddress,
            matchId: Buffer.from(room.matchIdBytes).toString('hex'),
            settlementSignature,
            serverPublicKey,
          }
        } as WsMessage));
      }
    }
  }

  /**
   * Settles an anti-cheat invalidated match on-chain.
   */
  private broadcastAntiCheatPenalty(room: Room, cheaterAddress: string) {
    // Anti-cheat penalty outcome: action = 1
    const action = 1;

    // We only need to tell the contract who the cheater is. The contract will refund the honest player 
    // and send the cheater's funds to the treasury.
    submitSettlementTransaction(action, room.matchIdBytes, cheaterAddress)
      .then(tx => console.log(`[RoomManager] Anti-Cheat penalty on-chain settlement completed. Tx: ${tx}`))
      .catch(err => console.error(`[RoomManager] Anti-Cheat Auto-settlement failed:`, err));
  }
}