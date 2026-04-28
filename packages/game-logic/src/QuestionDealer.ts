import type { Question as SchemaQuestion } from '@shared/question';
import type { CardType } from '@shared/websocket';
import type { EngineCard } from './types';

/**
 * Shuffles and deals questions from a pool into EngineCards.
 * Uses Fisher-Yates shuffle for unbiased randomization.
 * Each question is dealt at most once per match.
 */
export class QuestionDealer {
  private pool: SchemaQuestion[];
  private cursor: number = 0;

  constructor(questions: SchemaQuestion[]) {
    // Only keep questions that have exactly one correct answer
    this.pool = questions.filter(q => q.options.filter(o => o.score === true).length === 1);
    if (this.pool.length === 0) {
      console.warn('QuestionDealer initialized with 0 valid questions.');
    }
    this.shuffle();
  }

  /**
   * Deal a hand of N cards from the pool.
   */
  dealHand(size: number): EngineCard[] {
    const hand: EngineCard[] = [];
    for (let i = 0; i < size; i++) {
      const card = this.dealOne();
      if (card) hand.push(card);
    }
    return hand;
  }

  /**
   * Deal a single card from the pool.
   * Returns null if the pool is exhausted.
   */
  dealOne(): EngineCard | null {
    if (this.pool.length === 0) return null;

    if (this.cursor >= this.pool.length) {
      // Reshuffle if exhausted — allows infinite play within the timer
      this.cursor = 0;
      this.shuffle();
    }

    const question = this.pool[this.cursor];
    this.cursor++;

    // Find the correct option
    const correctOption = question.options.find(opt => opt.score === true);
    if (!correctOption) {
      console.warn(`Question ${question.id} has no correct answer, skipping.`);
      return this.dealOne();
    }

    // Randomly assign card type (60% attack, 40% heal)
    const type: CardType = Math.random() < 0.6 ? 'attack' : 'heal';

    return {
      id: `card-${question.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      question,
      correctOptionId: correctOption.id,
    };
  }

  /**
   * Number of questions remaining before reshuffle.
   */
  getRemainingCount(): number {
    return Math.max(0, this.pool.length - this.cursor);
  }

  /**
   * Fisher-Yates shuffle.
   */
  private shuffle(): void {
    for (let i = this.pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]];
    }
  }
}
