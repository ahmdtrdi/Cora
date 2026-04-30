import type { CharacterState, CardType, GamePhase } from '@shared/websocket';
import type { Question as SchemaQuestion } from '@shared/question';

/**
 * Internal engine representation of a player.
 * Contains server-side truth (e.g. correct answers in hand).
 */
export interface EnginePlayerState {
  address: string;
  health: number;
  score: number;
  roundsWon: number;
  hand: EngineCard[];
  characterState: CharacterState;
  lastPlayTimestamp?: number;
  queueIndex: number;
}

/**
 * Server-side card that includes the correct answer.
 * The `correctOptionId` is never sent to clients.
 */
export interface EngineCard {
  id: string;
  type: CardType;
  question: SchemaQuestion;
  correctOptionId: string;
}

/**
 * Result of a player playing a card, returned synchronously
 * by the engine to the caller (RoomManager).
 */
export interface PlayCardResult {
  success: boolean;
  correct: boolean;
  damage: number;
  heal: number;
  multiplier: number;
  cardType: CardType;
  targetAddress: string;
  attackerAddress: string;
  newTargetHealth: number;
  newAttackerHealth: number;
  gameOver: boolean;
  winnerAddress?: string;
  winReason?: 'hp_zero' | 'time_up' | 'forfeit';
  antiCheatVerdict?: AntiCheatVerdict;
}

/**
 * Statistics collected for a player during a match
 */
export interface PlayerMatchStats {
  totalPlays: number;
  correctPlays: number;
  accuracyRate: number;
  avgAnswerTimeMs: number;
  answerTimeStdDev: number;
  longestCorrectStreak: number;
  cooldownHits: number;
  cadenceCoeffOfVariation: number;
}

/**
 * A specific flag raised by the anti-cheat analyzer
 */
export interface AntiCheatFlag {
  signal: string;
  value: number;
  threshold: number;
  penalty: number;
  description: string;
}

/**
 * The final anti-cheat verdict for a player in a match
 */
export interface AntiCheatVerdict {
  playerAddress: string;
  trustScore: number;
  verdict: 'trusted' | 'suspicious' | 'rejected';
  flags: AntiCheatFlag[];
  stats: PlayerMatchStats;
}

/**
 * Events emitted by the GameEngine.
 */
export type GameEngineEventMap = {
  timerSync: { remainingMs: number; phase: GamePhase };
  phaseChange: { phase: GamePhase };
  roundOver: { winnerAddress: string | null; reason: 'hp_zero' | 'time_up' };
  gameOver: { winnerAddress: string; reason: 'hp_zero' | 'time_up' | 'forfeit'; antiCheatVerdicts?: Record<string, AntiCheatVerdict> };
  stateUpdate: {};
};

export type GameEngineEvent = keyof GameEngineEventMap;
