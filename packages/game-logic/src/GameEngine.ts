import type { Question as SchemaQuestion } from '@shared/question';
import type {
  GameState,
  GamePhase,
  TimerState,
  DamageEvent,
  PlayerState,
  Card,
  QuestionOption,
} from '@shared/websocket';
import type {
  EnginePlayerState,
  EngineCard,
  PlayCardResult,
  GameEngineEvent,
  GameEngineEventMap,
} from './types';
import { QuestionDealer } from './QuestionDealer';
import { AntiCheatAnalyzer } from './AntiCheatAnalyzer';

/**
 * Core game engine for a CORA match.
 *
 * Responsibilities:
 *  - 5-minute match timer with 1-minute "extra point" phase (×2 multiplier)
 *  - Player health management (100 HP start)
 *  - Scoring: correct attack = 10 dmg (×2 extra), correct heal = 10 HP (×2 extra)
 *  - Card dealing from a shuffled question pool (hand of 5, auto-refill)
 *  - Win condition evaluation (HP zero, timer expiry, forfeit)
 *
 * The engine is I/O-free. It emits events that the network layer (RoomManager)
 * listens to and broadcasts via WebSocket.
 */
export class GameEngine {
  // ─── Configuration ────────────────────────────────────────────
  static readonly MATCH_DURATION_MS = 300_000;          // 5 minutes
  static readonly EXTRA_POINT_THRESHOLD_MS = 60_000;    // last 1 minute
  static readonly ROUNDS_TO_WIN = 2;
  static readonly BASE_DAMAGE = 50;
  static readonly BASE_HEAL = 10;
  static readonly STARTING_HEALTH = 100;
  static readonly HAND_SIZE = 5;
  static readonly TICK_INTERVAL_MS = 1_000;             // 1 second
  static readonly EXTRA_POINT_MULTIPLIER = 2;
  static readonly DAMAGE_LOG_MAX = 20;

  // ─── State ────────────────────────────────────────────────────
  private players: Map<string, EnginePlayerState> = new Map();
  private playerAddresses: [string, string];
  private dealer: QuestionDealer;
  private antiCheat: AntiCheatAnalyzer;
  private phase: GamePhase = 'normal';
  private remainingMs: number = GameEngine.MATCH_DURATION_MS;
  private timerInterval: ReturnType<typeof setInterval> | null = null;
  private damageLog: DamageEvent[] = [];
  private started = false;
  private finished = false;
  private matchQueue: EngineCard[] = [];
  private currentRound: number = 1;

  // ─── Events ───────────────────────────────────────────────────
  private listeners: Map<string, Function[]> = new Map();

  constructor(playerAddresses: [string, string], questions: SchemaQuestion[]) {
    this.playerAddresses = playerAddresses;
    this.dealer = new QuestionDealer(questions);
    this.antiCheat = new AntiCheatAnalyzer();

    // Generate a shared queue of up to 100 cards for the entire match
    this.matchQueue = this.dealer.dealHand(100);

    // Initialize both players
    for (const address of playerAddresses) {
      // Both players start with a copy of the first 5 cards
      const hand = this.matchQueue.slice(0, GameEngine.HAND_SIZE).map(c => ({ ...c }));
      this.players.set(address, {
        address,
        health: GameEngine.STARTING_HEALTH,
        score: 0,
        roundsWon: 0,
        hand,
        characterState: 'stay',
        queueIndex: GameEngine.HAND_SIZE, // Next card to draw is at index 5
      });
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────

  /**
   * Start the match timer. Called once both players have deposited.
   */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.finished = false;
    this.remainingMs = GameEngine.MATCH_DURATION_MS;
    this.phase = 'normal';

    this.timerInterval = setInterval(() => this.tick(), GameEngine.TICK_INTERVAL_MS);
    this.emit('stateUpdate', {});
  }

  /**
   * Force-stop the match (forfeit / disconnect).
   */
  stop(forfeitAddress?: string): void {
    if (this.finished) return;
    this.finished = true;
    this.clearTimer();

    if (forfeitAddress) {
      const winnerAddress = this.playerAddresses.find(a => a !== forfeitAddress)!;
      this.emit('gameOver', {
        winnerAddress,
        reason: 'forfeit',
        antiCheatVerdicts: this.antiCheat.getVerdicts()
      });
    }
  }

  /**
   * Whether the match has started and not yet finished.
   */
  isActive(): boolean {
    return this.started && !this.finished;
  }

  /**
   * Whether the match has finished.
   */
  isFinished(): boolean {
    return this.finished;
  }

  // ─── Card Play ────────────────────────────────────────────────

  /**
   * Process a player playing a card with a selected answer.
   *
   * Returns a synchronous result so the caller can decide what to broadcast.
   */
  playCard(playerAddress: string, cardId: string, selectedOptionId: string): PlayCardResult {
    const player = this.players.get(playerAddress);
    const opponentAddress = this.playerAddresses.find(a => a !== playerAddress)!;
    const opponent = this.players.get(opponentAddress)!;

    if (!player || !opponent || this.finished) {
      return this.failResult(playerAddress, opponentAddress);
    }

    const now = Date.now();
    const lastPlay = player.lastPlayTimestamp || 0;

    // Check cooldown but don't return immediately, log to anti-cheat first
    const isCooldownHit = now - lastPlay < 500;

    if (isCooldownHit) {
      // Rate limit: 500ms cooldown
      this.antiCheat.recordPlay(playerAddress, false, true);
      return this.failResult(playerAddress, opponentAddress);
    }

    player.lastPlayTimestamp = now;

    // Find the card in the player's hand
    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) {
      return this.failResult(playerAddress, opponentAddress);
    }

    const card = player.hand[cardIndex];
    const correct = card.correctOptionId === selectedOptionId;
    const multiplier = this.phase === 'extra_point' ? GameEngine.EXTRA_POINT_MULTIPLIER : 1;

    let damage = 0;
    let heal = 0;

    if (correct) {
      if (card.type === 'attack') {
        damage = GameEngine.BASE_DAMAGE * multiplier;
        opponent.health = Math.max(0, opponent.health - damage);
        player.score += damage;
        player.characterState = 'action';
        opponent.characterState = 'angry';
      } else {
        // heal
        heal = GameEngine.BASE_HEAL * multiplier;
        player.health = Math.min(GameEngine.STARTING_HEALTH, player.health + heal);
        player.score += heal;
        player.characterState = 'happy';
      }
    } else {
      // Wrong answer — no effect, but still consume the card
      player.characterState = 'stay';
    }

    // Record the play in anti-cheat analyzer
    this.antiCheat.recordPlay(playerAddress, correct, false);

    // Remove the played card and deal a new one from the shared queue
    player.hand.splice(cardIndex, 1);
    if (player.queueIndex < this.matchQueue.length) {
      const newCard = this.matchQueue[player.queueIndex];
      player.hand.push({ ...newCard });
      player.queueIndex++;
    }

    // Record damage event
    if (correct) {
      const event: DamageEvent = {
        attackerAddress: playerAddress,
        targetAddress: card.type === 'attack' ? opponentAddress : playerAddress,
        damage: card.type === 'attack' ? damage : heal,
        multiplier,
        type: card.type,
        timestamp: Date.now(),
      };
      this.damageLog.push(event);
      if (this.damageLog.length > GameEngine.DAMAGE_LOG_MAX) {
        this.damageLog.shift();
      }
    }

    // Check HP-based win condition
    const roundOver = opponent.health <= 0;
    let gameOver = false;
    let winnerAddress: string | undefined = undefined;

    if (roundOver) {
      const winnerPlayer = this.players.get(playerAddress);
      if (winnerPlayer) winnerPlayer.roundsWon += 1;

      const p1 = this.players.get(this.playerAddresses[0])!;
      const p2 = this.players.get(this.playerAddresses[1])!;

      if (p1.roundsWon >= GameEngine.ROUNDS_TO_WIN || p2.roundsWon >= GameEngine.ROUNDS_TO_WIN) {
        gameOver = true;
        winnerAddress = playerAddress;
        this.finished = true;
        this.clearTimer();
        const verdicts = this.antiCheat.getVerdicts();
        this.emit('gameOver', {
          winnerAddress: playerAddress,
          reason: 'hp_zero',
          antiCheatVerdicts: verdicts
        });
      } else {
        this.resetRound();
        this.emit('roundOver', { winnerAddress: playerAddress, reason: 'hp_zero' });
      }
    }

    this.emit('stateUpdate', {});

    return {
      success: true,
      correct,
      damage,
      heal,
      multiplier,
      cardType: card.type,
      targetAddress: card.type === 'attack' ? opponentAddress : playerAddress,
      attackerAddress: playerAddress,
      newTargetHealth: card.type === 'attack' ? opponent.health : player.health,
      newAttackerHealth: player.health,
      gameOver,
      winnerAddress,
      winReason: gameOver ? 'hp_zero' : undefined,
    };
  }

  /**
   * Reset character states to 'stay'. Called by caller (e.g. RoomManager) after animations.
   */
  resetRound(): void {
    this.currentRound += 1;
    this.remainingMs = GameEngine.MATCH_DURATION_MS;
    this.phase = 'normal';
    for (const player of this.players.values()) {
      player.health = GameEngine.STARTING_HEALTH;
      player.characterState = 'stay';
    }
    // Broadcast updated state so frontend sees new round, reset health, and timer
    this.emit('stateUpdate', {});
  }

  resetCharacterStates(): void {
    for (const player of this.players.values()) {
      player.characterState = 'stay';
    }
    this.emit('stateUpdate', {});
  }

  // ─── State Accessors ─────────────────────────────────────────

  /**
   * Get anti-cheat verdicts for all players.
   * Typically called after the match finishes.
   */
  getAntiCheatVerdicts() {
    return this.antiCheat.getVerdicts();
  }

  /**
   * Build the GameState payload for a specific player.
   * Each player sees their own hand but not the opponent's.
   */
  getStateForPlayer(address: string): GameState {
    const player = this.players.get(address)!;
    const opponentAddress = this.playerAddresses.find(a => a !== address)!;
    const opponent = this.players.get(opponentAddress)!;

    return {
      status: this.finished ? 'finished' : 'playing',
      player: this.toPlayerState(player),
      opponent: this.toPlayerState(opponent),
      hand: this.toClientCards(player.hand),
      timer: this.getTimerState(),
      damageLog: [...this.damageLog],
      currentRound: this.currentRound,
      roundsToWin: GameEngine.ROUNDS_TO_WIN,
    };
  }

  /**
   * Get current timer state.
   */
  getTimerState(): TimerState {
    return {
      totalDurationMs: GameEngine.MATCH_DURATION_MS,
      remainingMs: this.remainingMs,
      phase: this.phase,
      extraPointThresholdMs: GameEngine.EXTRA_POINT_THRESHOLD_MS,
    };
  }

  /**
   * Get scores for all players.
   */
  getScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      scores[addr] = state.score;
    }
    return scores;
  }

  /**
   * Get health for all players.
   */
  getHealth(): Record<string, number> {
    const health: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      health[addr] = state.health;
    }
    return health;
  }

  /**
   * Get rounds won for all players.
   */
  getRoundsWon(): Record<string, number> {
    const rounds: Record<string, number> = {};
    for (const [addr, state] of this.players) {
      rounds[addr] = state.roundsWon;
    }
    return rounds;
  }

  /**
   * Get current round number (1-based).
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * Get all player addresses.
   */
  getPlayerAddresses(): [string, string] {
    return this.playerAddresses;
  }

  // ─── Event System ─────────────────────────────────────────────

  on<E extends GameEngineEvent>(event: E, callback: (data: GameEngineEventMap[E]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  off<E extends GameEngineEvent>(event: E, callback: Function): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      const idx = cbs.indexOf(callback);
      if (idx !== -1) cbs.splice(idx, 1);
    }
  }

  private emit<E extends GameEngineEvent>(event: E, data: GameEngineEventMap[E]): void {
    const cbs = this.listeners.get(event);
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(data);
        } catch (err) {
          console.error(`GameEngine event handler error [${event}]:`, err);
        }
      }
    }
  }

  // ─── Timer Internals ─────────────────────────────────────────

  private tick(): void {
    if (this.finished) {
      this.clearTimer();
      return;
    }

    this.remainingMs = Math.max(0, this.remainingMs - GameEngine.TICK_INTERVAL_MS);

    // Check for phase transition: normal → extra_point
    if (
      this.phase === 'normal' &&
      this.remainingMs <= GameEngine.EXTRA_POINT_THRESHOLD_MS
    ) {
      this.phase = 'extra_point';
      this.emit('phaseChange', { phase: 'extra_point' });
    }

    // Emit timer sync every tick
    this.emit('timerSync', {
      remainingMs: this.remainingMs,
      phase: this.phase,
    });

    // Time's up — determine winner
    if (this.remainingMs <= 0) {
      const winner = this.determineWinnerByScore();
      if (winner) {
        const winnerPlayer = this.players.get(winner);
        if (winnerPlayer) winnerPlayer.roundsWon += 1;
      }

      const p1 = this.players.get(this.playerAddresses[0])!;
      const p2 = this.players.get(this.playerAddresses[1])!;

      if (p1.roundsWon >= GameEngine.ROUNDS_TO_WIN || p2.roundsWon >= GameEngine.ROUNDS_TO_WIN) {
        this.finished = true;
        this.clearTimer();
        this.emit('gameOver', {
          winnerAddress: winner!,
          reason: 'time_up',
          antiCheatVerdicts: this.antiCheat.getVerdicts()
        });
      } else {
        this.resetRound();
        this.emit('roundOver', { winnerAddress: winner, reason: 'time_up' });
      }
    }
  }

  private clearTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * When time expires, determine winner by:
   * 1. Highest HP
   * 2. Tie-break: highest score
   * 3. Double tie: first player (arbitrary but deterministic)
   */
  private determineWinnerByScore(): string {
    const [addrA, addrB] = this.playerAddresses;
    const a = this.players.get(addrA)!;
    const b = this.players.get(addrB)!;

    if (a.health !== b.health) {
      return a.health > b.health ? addrA : addrB;
    }
    if (a.score !== b.score) {
      return a.score > b.score ? addrA : addrB;
    }
    // True tie — first player wins (deterministic)
    return addrA;
  }

  // ─── Helpers ──────────────────────────────────────────────────

  /**
   * Convert internal player state to client-safe PlayerState.
   */
  private toPlayerState(player: EnginePlayerState): PlayerState {
    return {
      address: player.address,
      baseHealth: player.health,
      characterState: player.characterState,
      score: player.score,
      roundsWon: player.roundsWon,
    };
  }

  /**
   * Strip correct answers from cards before sending to clients.
   */
  private toClientCards(hand: EngineCard[]): Card[] {
    return hand.map(card => ({
      id: card.id,
      type: card.type,
      question: {
        id: card.question.id,
        text: card.question.questionText,
        options: card.question.options.map(opt => ({
          id: opt.id,
          text: opt.text,
        } as QuestionOption)),
      },
    }));
  }

  /**
   * Build a failure PlayCardResult.
   */
  private failResult(playerAddress: string, opponentAddress: string): PlayCardResult {
    const player = this.players.get(playerAddress);
    const opponent = this.players.get(opponentAddress);
    return {
      success: false,
      correct: false,
      damage: 0,
      heal: 0,
      multiplier: 1,
      cardType: 'attack',
      targetAddress: opponentAddress,
      attackerAddress: playerAddress,
      newTargetHealth: opponent?.health ?? 0,
      newAttackerHealth: player?.health ?? 0,
      gameOver: false,
    };
  }
}
