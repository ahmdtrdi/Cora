export type CharacterState = 'stay' | 'action' | 'angry' | 'happy';
export type CardType = 'heal' | 'attack';
export type GameStatus = 'waiting' | 'depositing' | 'playing' | 'finished';
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

// Messages sent from Client -> Server
export type ClientToServerEvents = {
  playCard: (cardId: string, selectedOptionId: string) => void;
  confirmDeposit: (signature: string) => void;
};

// Messages sent from Server -> Client
export type ServerToClientEvents = {
  gameStateUpdate: (state: GameState) => void;
  matchResult: (result: MatchResult) => void;
  timerSync: (timer: TimerState) => void;
  damageEvent: (event: DamageEvent) => void;
  phaseChange: (phase: GamePhase) => void;
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
