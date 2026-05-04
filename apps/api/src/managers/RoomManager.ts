import type { ServerWebSocket } from 'bun';
import type {
  GameState,
  WsMessage,
  GameStatus,
  MatchResult,
  ScoreUpdateData,
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
  characterId: string;
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
  private DEPOSIT_TIMEOUT_MS = 30_000;     // 20 seconds per player during 'depositing'
  private CARD_ANSWER_TIMEOUT_MS = 10_000; // 10 seconds per card
  private CARD_COUNTDOWN_TICK_MS = 1_000;  // 1 second countdown tick

  // ─── FIFO Queue Debug Visualization ────────────────────────────

  private shortAddr(address: string): string {
    if (address.length <= 12) return address;
    return `${address.slice(0, 4)}..${address.slice(-4)}`;
  }

  private printQueueState(event: string, detail: string = '') {
    const C = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      cyan: '\x1b[36m',
      yellow: '\x1b[33m',
      green: '\x1b[32m',
      magenta: '\x1b[35m',
      red: '\x1b[31m',
      white: '\x1b[37m',
      bgCyan: '\x1b[46m',
      bgBlack: '\x1b[40m',
    };

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    const W = 56; // box width
    const hr = C.dim + '─'.repeat(W) + C.reset;

    console.log('');
    console.log(`${C.cyan}${C.bold}┌${'─'.repeat(W)}┐${C.reset}`);
    console.log(`${C.cyan}│${C.reset} ${C.bold}🎮 MATCHMAKING FIFO${C.reset}${' '.repeat(W - 21)}${C.cyan}│${C.reset}`);
    console.log(`${C.cyan}│${C.reset} ${C.dim}${time}${C.reset}${' '.repeat(W - time.length - 2)}${C.cyan}│${C.reset}`);
    console.log(`${C.cyan}├${'─'.repeat(W)}┤${C.reset}`);

    // Event line
    const eventLine = ` ${event}`;
    const pad1 = Math.max(0, W - eventLine.length);
    console.log(`${C.cyan}│${C.reset}${C.yellow}${C.bold}${eventLine}${C.reset}${' '.repeat(pad1)}${C.cyan}│${C.reset}`);

    if (detail) {
      const detailLine = `   ${detail}`;
      const pad2 = Math.max(0, W - detailLine.length);
      console.log(`${C.cyan}│${C.reset}${C.dim}${detailLine}${C.reset}${' '.repeat(pad2)}${C.cyan}│${C.reset}`);
    }

    console.log(`${C.cyan}├${'─'.repeat(W)}┤${C.reset}`);

    // Queue section
    const qLen = this.matchmakingQueue.length;
    const qTitle = ` 🧍 Queue (${qLen} waiting)`;
    const pad3 = Math.max(0, W - qTitle.length);
    console.log(`${C.cyan}│${C.reset}${C.magenta}${C.bold}${qTitle}${C.reset}${' '.repeat(pad3)}${C.cyan}│${C.reset}`);

    if (qLen === 0) {
      const emptyLine = `   (empty)`;
      const padE = Math.max(0, W - emptyLine.length);
      console.log(`${C.cyan}│${C.reset}${C.dim}${emptyLine}${C.reset}${' '.repeat(padE)}${C.cyan}│${C.reset}`);
    } else {
      this.matchmakingQueue.forEach((q, i) => {
        const addr = this.shortAddr(q.address);
        const line = `   ${i + 1}. ${addr}`;
        const padQ = Math.max(0, W - line.length);
        console.log(`${C.cyan}│${C.reset}${C.white} ${line}${C.reset}${' '.repeat(padQ - 1)}${C.cyan}│${C.reset}`);
      });
    }

    console.log(`${C.cyan}├${'─'.repeat(W)}┤${C.reset}`);

    // Active rooms section
    const activeRooms = Array.from(this.rooms.values()).filter(r => r.status !== 'finished');
    const rTitle = ` 🏠 Active Rooms (${activeRooms.length})`;
    const pad4 = Math.max(0, W - rTitle.length);
    console.log(`${C.cyan}│${C.reset}${C.green}${C.bold}${rTitle}${C.reset}${' '.repeat(pad4)}${C.cyan}│${C.reset}`);

    if (activeRooms.length === 0) {
      const emptyLine = `   (none)`;
      const padE = Math.max(0, W - emptyLine.length);
      console.log(`${C.cyan}│${C.reset}${C.dim}${emptyLine}${C.reset}${' '.repeat(padE)}${C.cyan}│${C.reset}`);
    } else {
      for (const room of activeRooms) {
        const players = Array.from(room.clients.keys()).map(a => this.shortAddr(a));
        const statusIcon = room.status === 'waiting' ? '⏳' : room.status === 'depositing' ? '💰' : room.status === 'playing' ? '⚔️' : '🏁';
        const roomShort = room.id.length > 20 ? room.id.slice(0, 20) + '..' : room.id;
        const line = `   ${statusIcon} ${roomShort}`;
        const padR = Math.max(0, W - line.length);
        console.log(`${C.cyan}│${C.reset}${C.white} ${line}${C.reset}${' '.repeat(padR - 1)}${C.cyan}│${C.reset}`);
        const pLine = `      ${players.join(' vs ') || '(no players yet)'}`;
        const padP = Math.max(0, W - pLine.length);
        console.log(`${C.cyan}│${C.reset}${C.dim}${pLine}${C.reset}${' '.repeat(padP)}${C.cyan}│${C.reset}`);
      }
    }

    console.log(`${C.cyan}└${'─'.repeat(W)}┘${C.reset}`);
    console.log('');
  }

  // ─── End Debug Visualization ───────────────────────────────────

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
      playerMeta: new Map([[playerAPubkey, { hasDeposited: false, characterId: 'einstein' }]]),
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
    room.playerMeta.set(playerBPubkey, { hasDeposited: false, characterId: 'einstein' });
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
            c.ws.send(JSON.stringify({ type: 'matchFound', payload: { roomId: newRoomId, role: 'playerA', opponentAddress: '' } } satisfies WsMessage));
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
    // 1. If this address already has an active (non-finished) room, return it immediately.
    //    This handles retries where the first HTTP response was lost due to proxy/network issues.
    for (const room of this.rooms.values()) {
      if ((room.playerA === address || room.playerB === address) && room.status !== 'finished') {
        this.printQueueState('♻️  RECONNECT', `${this.shortAddr(address)} already in room ${room.id}`);
        return room.id;
      }
    }

    // 2. If this address is already queued (from a previous dropped HTTP request),
    //    chain this request's resolve to the existing entry instead of adding a duplicate.
    const existingIndex = this.matchmakingQueue.findIndex(q => q.address === address);
    if (existingIndex !== -1) {
      this.printQueueState('♻️  RE-QUEUE', `${this.shortAddr(address)} already waiting — chaining request`);
      const existing = this.matchmakingQueue[existingIndex];
      return new Promise<string>((resolve) => {
        const originalResolve = existing.resolve;
        existing.resolve = (roomId: string) => {
          originalResolve(roomId);
          resolve(roomId);
        };
        // Update the WS reference if provided
        if (signal) {
          // Allow the NEW signal to cancel (removes from queue) since the old HTTP request is dead
          signal.addEventListener('abort', () => {
            const qIndex = this.matchmakingQueue.indexOf(existing);
            if (qIndex !== -1) {
              this.matchmakingQueue.splice(qIndex, 1);
              this.printQueueState('❌ PLAYER LEFT', `${this.shortAddr(address)} aborted matchmaking`);
            }
          });
        }
      });
    }

    this.printQueueState('⬆️  PLAYER JOINING', `${this.shortAddr(address)} wants to play`);

    // Check if there is another player in queue who isn't the same address
    const index = this.matchmakingQueue.findIndex((q) => q.address !== address);

    if (index !== -1) {
      // Pair found — Player A is the waiting player (initializer), Player B is the incoming player
      const playerAEntry = this.matchmakingQueue.splice(index, 1)[0];
      const newRoomId = `room-${Date.now()}`;
      const room = this.createRoom(newRoomId);

      this.printQueueState(
        '✅ MATCH FOUND!',
        `${this.shortAddr(playerAEntry.address)} 🆚 ${this.shortAddr(address)} → ${newRoomId}`,
      );

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
      const queueItem = { address, resolve, enqueuedAt: Date.now() };
      this.matchmakingQueue.push(queueItem);

      this.printQueueState('⏳ WAITING', `${this.shortAddr(address)} added to queue (no opponent yet)`);

      // Server-side TTL: remove ghost entries after 5 minutes to prevent memory leaks.
      // The client can always re-queue via a new POST /match request.
      const ttlHandle = setTimeout(() => {
        const qIndex = this.matchmakingQueue.indexOf(queueItem);
        if (qIndex !== -1) {
          this.matchmakingQueue.splice(qIndex, 1);
          this.printQueueState('⏰ TTL EXPIRED', `${this.shortAddr(address)} removed after 5m timeout`);
        }
      }, 300_000); // 5 minutes

      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(ttlHandle);
          const qIndex = this.matchmakingQueue.indexOf(queueItem);
          if (qIndex !== -1) {
            this.matchmakingQueue.splice(qIndex, 1);
            this.printQueueState('❌ PLAYER LEFT', `${this.shortAddr(address)} aborted matchmaking`);
          }
        });
      }
    });
  }

  public joinRoom(roomId: string, address: string, ws: ServerWebSocket<unknown>, characterId: string = 'einstein') {
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
      // Update characterId on reconnect just in case
      const meta = room.playerMeta.get(address);
      if (meta) meta.characterId = characterId;
    } else {
      // New join
      if (room.clients.size >= 2) {
        console.warn(`Room ${roomId} is full.`);
        ws.close(1008, 'Room is full');
        return;
      }

      console.log(`Player ${address} joined room ${roomId} as ${characterId}`);
      room.clients.set(address, {
        ws,
        disconnectTimeout: null,
      });

      room.playerMeta.set(address, {
        hasDeposited: false,
        characterId,
      });
    }

    // Check if we can start depositing
    if (room.status === 'waiting' && room.clients.size === 2) {
      room.status = 'depositing';
      console.log(`Room ${roomId} has 2 players. Transitioning to depositing!`);
    }

    // If both players already deposited but the game didn't start (because a WebSocket wasn't
    // connected yet), start now that we have both connections.
    if (room.status === 'depositing' && room.clients.size === 2 && room.playerA && room.playerB) {
      const metaA = room.playerMeta.get(room.playerA);
      const metaB = room.playerMeta.get(room.playerB);
      if ((metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false)) {
        for (const t of room.depositTimeouts.values()) clearTimeout(t);
        room.depositTimeouts.clear();
        room.status = 'playing';
        console.log(`Room ${roomId}: Late join triggered game start — both already deposited!`);
        this.initializeEngine(room);
        return; // broadcastGameState is called inside initializeEngine
      }
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
      // Let the deposit shot clock (DEPOSIT_TIMEOUT_MS) handle cancellation
      // if they don't reconnect and deposit in time.
      console.log(`Player ${address} temporarily disconnected during depositing in room ${roomId}. Waiting for reconnect or timeout.`);
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

    // Sequential unlock: after A deposits, notify B they can deposit and arm their shot clock.
    // Only send unlock + shot clock if B hasn't already deposited.
    if (isPlayerA && !room.playerBUnlocked && room.playerB) {
      room.playerBUnlocked = true;
      const playerBMeta = room.playerMeta.get(room.playerB);
      const playerBAlreadyDeposited = playerBMeta?.hasDeposited ?? false;

      if (!playerBAlreadyDeposited) {
        const playerBClient = room.clients.get(room.playerB);
        if (playerBClient?.ws) {
          playerBClient.ws.send(JSON.stringify({
            type: 'depositUnlocked',
            payload: { roomId: room.id },
          } satisfies WsMessage));
        }
        this.armDepositTimeout(room, room.playerB);
      }
      console.log(`Room ${room.id}: Player A deposited. Player B unlocked.`);
      // Fall through to allDeposited check — B may have already deposited
    }

    // Both players must be assigned, connected, AND have deposited before starting
    if (!room.playerA || !room.playerB) return;
    const metaA = room.playerMeta.get(room.playerA);
    const metaB = room.playerMeta.get(room.playerB);
    const allDeposited = (metaA?.hasDeposited ?? false) && (metaB?.hasDeposited ?? false);

    if (allDeposited && room.status === 'depositing') {
      // Ensure both players are actually WebSocket-connected
      if (room.clients.size < 2) {
        console.log(`Room ${room.id}: Both deposited but only ${room.clients.size} player(s) connected. Waiting for both.`);
        return;
      }

      for (const t of room.depositTimeouts.values()) clearTimeout(t);
      room.depositTimeouts.clear();

      room.status = 'playing';
      console.log(`Room ${room.id} both players deposited. Initializing game engine!`);
      this.initializeEngine(room);
    }
  }

  // ─── Engine Initialization ────────────────────────────────────

  private initializeEngine(room: Room) {
    if (!room.playerA || !room.playerB) {
      console.error(`Room ${room.id} missing player assignments. Cannot start.`);
      return;
    }

//     const addresses: [string, string] = [room.playerA, room.playerB];
    const addresses = Array.from(room.clients.keys()) as [string, string];
    const playersInfo: [{ address: string; characterId: string }, { address: string; characterId: string }] = [
      { address: addresses[0], characterId: room.playerMeta.get(addresses[0])?.characterId || 'einstein' },
      { address: addresses[1], characterId: room.playerMeta.get(addresses[1])?.characterId || 'einstein' }
    ];
    const questions = loadQuestions();

    if (questions.length === 0) {
      console.error(`No questions loaded! Cannot start match in room ${room.id}.`);
      return;
    }

    const engine = new GameEngine(playersInfo, questions);
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
      const roundNum = engine.getCurrentRound() - 1; // currentRound is already incremented (resetRound runs before this event)
      const roundsWon = engine.getRoundsWon();
      console.log(`Room ${room.id} round ${roundNum} over. Winner: ${data.winnerAddress} (${data.reason})`);
      console.log(`  Rounds won:`, roundsWon);

      // Clear any opened cards to reset for the next round
      this.clearAllOpenedCards(room);

      this.broadcastToRoom(room, {
        type: 'roundOver',
        payload: {
          winnerAddress: data.winnerAddress,
          reason: data.reason,
          roundNumber: roundNum,
          roundsWon,
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
            roundsWon: 0,
            characterId: room.playerMeta.get(address)?.characterId || 'einstein',
          },
          opponent: opponentAddress
            ? {
              address: opponentAddress,
              baseHealth: 100,
              characterState: 'stay',
              score: 0,
              roundsWon: 0,
              characterId: room.playerMeta.get(opponentAddress)?.characterId || 'einstein',
            }
            : {
              address: 'Waiting for opponent...',
              baseHealth: 100,
              characterState: 'stay',
              score: 0,
              roundsWon: 0,
              characterId: 'einstein',
            },
          hand: [],
          timer: {
            totalDurationMs: GameEngine.MATCH_DURATION_MS,
            remainingMs: GameEngine.MATCH_DURATION_MS,
            phase: 'normal',
            extraPointThresholdMs: GameEngine.EXTRA_POINT_THRESHOLD_MS,
          },
          damageLog: [],
          currentRound: 1,
          roundsToWin: GameEngine.ROUNDS_TO_WIN,
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