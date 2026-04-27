import { test, expect, describe } from 'bun:test';
import { GameEngine } from '../src/GameEngine';
import type { Question } from '@shared/question';

const mockQuestions: Question[] = [
  {
    id: "q_1",
    category: "math",
    questionText: "1+1?",
    options: [
      { id: "A", text: "2", score: true },
      { id: "B", text: "3", score: false },
      { id: "C", text: "4", score: false },
      { id: "D", text: "5", score: false }
    ],
    explanation: "yes"
  },
  {
    id: "q_2",
    category: "logical",
    questionText: "is it?",
    options: [
      { id: "A", text: "no", score: false },
      { id: "B", text: "yes", score: true },
      { id: "C", text: "maybe", score: false },
      { id: "D", text: "idk", score: false }
    ],
    explanation: "yes"
  }
];

describe('GameEngine', () => {
  test('initializes correctly', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    const healths = engine.getHealth();
    expect(healths['player1']).toBe(100);
    expect(healths['player2']).toBe(100);
    
    const state1 = engine.getStateForPlayer('player1');
    expect(state1.hand.length).toBe(5);
    expect(state1.timer.remainingMs).toBe(300_000);
  });

  test('playCard calculates correctly', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    engine.start();

    const state1 = engine.getStateForPlayer('player1');
    const firstCard = state1.hand[0];
    
    // Cheat a little to find correct option since tests need to test it
    // In our mock, "A" is correct for q_1, "B" is correct for q_2
    const correctOptionId = firstCard.question.id === 'q_1' ? 'A' : 'B';
    
    const result = engine.playCard('player1', firstCard.id, correctOptionId);
    
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    
    const healths = engine.getHealth();
    if (result.cardType === 'attack') {
      expect(healths['player2']).toBe(90); // 100 - 10
      expect(healths['player1']).toBe(100);
    } else {
      expect(healths['player2']).toBe(100);
      expect(healths['player1']).toBe(100); // capped at 100
    }
    
    expect(engine.getScores()['player1']).toBe(10);
  });
});
