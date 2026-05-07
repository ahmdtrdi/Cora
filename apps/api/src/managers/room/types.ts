import type { ServerWebSocket } from 'bun';
import type { GameStatus } from '@shared/websocket';
import { GameEngine } from '@cora/game-logic';

export interface RoomClient {
  ws: ServerWebSocket<unknown> | null;
  disconnectTimeout: ReturnType<typeof setTimeout> | null;
}

export interface ServerPlayerMeta {
  hasDeposited: boolean;
  characterId: string;
}

export interface OpenedCard {
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
  /** Ephemeral Rollup session PDA (set when MagicBlock is enabled) */
  erSessionPda: string | null;
  /** USD value of the wager */
  wagerUsdValue?: string | null;
}
