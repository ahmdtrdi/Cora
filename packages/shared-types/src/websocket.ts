export type CharacterState = 'stay' | 'action' | 'angry' | 'happy';
export type CardType = 'heal' | 'attack';
export type GameStatus = 'waiting' | 'depositing' | 'playing' | 'settling' | 'finished';
export type GamePhase = 'normal' | 'extra_point';

export interface PlayerState {
  address: string;
  baseHealth: number;
  characterState: CharacterState;
  score: number;
}

export interface TimerState {
  /** Total match duration in ms (300000 = 5 min) */
  totalDurationMs: number;
  /** Remaining time in ms */
  remainingMs: number;
  /** Current game phase */
  phase: GamePhase;
  /** Threshold in ms when extra_point phase begins (60000 = last 1 min) */
  extraPointThresholdMs: number;
}

export interface DamageEvent {
  attackerAddress: string;
  targetAddress: string;
  damage: number;
  multiplier: number;
  type: CardType;
  timestamp: number;
}

export interface Question {
  id: string;
  text: string;
  options: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Card {
  id: string;
  type: CardType;
  question: Question;
}

export interface GameState {
  status: GameStatus;
  player: PlayerState;
  opponent: PlayerState;
  hand: Card[];
  timer: TimerState;
  damageLog: DamageEvent[];
}

// ─── Card Countdown Pipeline Types ────────────────────────────

export interface CardCountdownData {
  cardId: string;
  /** Remaining time in ms for this card's answer window */
  remainingMs: number;
}

export interface CardExpiredData {
  /** The card that timed out */
  cardId: string;
}

export interface ScoreUpdateData {
  playerAddress: string;
  opponentAddress: string;
  playerScore: number;
  opponentScore: number;
  playerHealth: number;
  opponentHealth: number;
}

// Messages sent from Client -> Server
export type ClientToServerEvents = {
  openCard: (data: { cardId: string }) => void;
  playCard: (cardId: string, selectedOptionId: string) => void;
  confirmDeposit: (signature: string) => void;
};

// Settlement result payload sent after match ends
export interface MatchResultPayload {
  winner: string;
  /** 32-byte match ID as hex string — use to derive PDA on-chain */
  matchId: string;
  /** Server's ed25519 settlement signature (base58 encoded) */
  settlementSignature: string;
  /** Server public key (base58) — matches the one stored in MatchState on-chain */
  serverPublicKey: string;
}

// Messages sent from Server -> Client
export type ServerToClientEvents = {
  gameStateUpdate: (state: GameState) => void;
  matchResult: (result: MatchResultPayload) => void;
  timerSync: (timer: TimerState) => void;
  damageEvent: (event: DamageEvent) => void;
  phaseChange: (phase: GamePhase) => void;
  playCardResult: (result: { correct: boolean; damage: number; heal: number; multiplier: number; cardType: CardType }) => void;
  cardCountdown: (data: CardCountdownData) => void;
  cardExpired: (data: CardExpiredData) => void;
  scoreUpdate: (data: ScoreUpdateData) => void;
};

export interface MatchResult {
  winnerAddress: string;
  reason: 'hp_zero' | 'time_up' | 'forfeit';
  finalScores: Record<string, number>;
  finalHealth: Record<string, number>;
}

// Serialization format for native WebSocket (since we aren't using Socket.io)
export interface WsMessage<T = any> {
  type: string;
  payload: T;
}
