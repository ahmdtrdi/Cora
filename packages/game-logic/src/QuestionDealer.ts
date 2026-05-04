import type { Question as SchemaQuestion } from '@shared/question';
import type { CardType } from '@shared/websocket';
import type { EngineCard } from './types';

/**
 * Shuffles and deals questions from a pool into EngineCards.
 * Uses a balanced round-robin selection across categories.
 * Each question is dealt at most once per match.
 */
export class QuestionDealer {
  private categories: string[];
  private poolsByCategory: Record<string, SchemaQuestion[]> = {};
  private currentCategoryIndex: number = 0;
  private totalRemaining: number = 0;

  constructor(questions: SchemaQuestion[]) {
    // Only keep questions that have exactly one correct answer
    const validQuestions = questions.filter(q => q.options.filter(o => o.score === true).length === 1);
    
    if (validQuestions.length === 0) {
      console.warn('QuestionDealer initialized with 0 valid questions.');
    }

    // Group by category
    for (const q of validQuestions) {
      const category = q.category || 'uncategorized';
      if (!this.poolsByCategory[category]) {
        this.poolsByCategory[category] = [];
      }
      this.poolsByCategory[category].push(q);
    }

    this.categories = Object.keys(this.poolsByCategory);

    // Shuffle each category pool
    for (const category of this.categories) {
      this.shuffle(this.poolsByCategory[category]);
      this.totalRemaining += this.poolsByCategory[category].length;
    }
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
   * Deal a single card from the pool, balancing categories.
   * Returns null if all questions are exhausted.
   */
  dealOne(): EngineCard | null {
    if (this.totalRemaining === 0) return null;

    let attempts = 0;
    let question: SchemaQuestion | undefined;

    // Try to find a question by cycling through categories
    while (attempts < this.categories.length) {
      const category = this.categories[this.currentCategoryIndex];
      const pool = this.poolsByCategory[category];

      this.currentCategoryIndex = (this.currentCategoryIndex + 1) % this.categories.length;

      if (pool.length > 0) {
        question = pool.pop();
        this.totalRemaining--;
        break;
      }
      attempts++;
    }

    if (!question) {
      return null;
    }

    // Find the correct option
    const correctOption = question.options.find(opt => opt.score === true);
    if (!correctOption) {
      console.warn(`Question ${question.id} has no correct answer, skipping.`);
      return this.dealOne(); // Attempt to draw again
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
   * Number of questions remaining before exhaustion.
   */
  getRemainingCount(): number {
    return this.totalRemaining;
  }

  /**
   * Fisher-Yates shuffle.
   */
  private shuffle(array: SchemaQuestion[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }
}
