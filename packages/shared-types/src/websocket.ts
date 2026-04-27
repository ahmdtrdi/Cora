export type CharacterState = 'stay' | 'action' | 'angry' | 'happy';
export type CardType = 'heal' | 'attack';
export type GameStatus = 'waiting' | 'round_starting' | 'playing' | 'round_ended' | 'match_ended';

export interface PlayerState {
  address: string;
  baseHealth: number;
  characterState: CharacterState;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
}

export interface Card {
  id: string;
  type: CardType;
  question: Question;
}

export interface GameState {
  status: GameStatus;
  currentRound: number; // 1 to 3
  player: PlayerState;
  opponent: PlayerState;
  hand: Card[]; // The player's available cards
}

// Messages sent from Client -> Server
export type ClientToServerEvents = {
  playCard: (cardId: string, selectedOptionIndex: number) => void;
};

// Messages sent from Server -> Client
export type ServerToClientEvents = {
  gameStateUpdate: (state: GameState) => void;
  matchResult: (winnerAddress: string) => void;
};

// Serialization format for native WebSocket (since we aren't using Socket.io)
export interface WsMessage<T = any> {
  type: string;
  payload: T;
}
