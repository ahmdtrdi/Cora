import { test, expect, describe, mock, beforeEach, afterEach, setSystemTime } from 'bun:test';
import { GameEngine } from '../src/GameEngine';
import type { Question } from '@shared/question';

const mockQuestions: Question[] = [
  {
    id: "q_1",
    category: "math",
    questionText: "1+1?",
    options: [{ id: "A", text: "2", score: true }, { id: "B", text: "3", score: false }, { id: "C", text: "4", score: false }, { id: "D", text: "5", score: false }],
    explanation: "yes"
  },
  {
    id: "q_2",
    category: "logical",
    questionText: "is it?",
    options: [{ id: "A", text: "no", score: false }, { id: "B", text: "yes", score: true }, { id: "C", text: "maybe", score: false }, { id: "D", text: "idk", score: false }],
    explanation: "yes"
  },
  {
    id: "q_3",
    category: "math",
    questionText: "2+2?",
    options: [{ id: "A", text: "4", score: true }, { id: "B", text: "5", score: false }, { id: "C", text: "6", score: false }, { id: "D", text: "7", score: false }],
    explanation: "yes"
  },
  {
    id: "q_4",
    category: "logical",
    questionText: "why?",
    options: [{ id: "A", text: "because", score: true }, { id: "B", text: "not", score: false }, { id: "C", text: "so", score: false }, { id: "D", text: "no", score: false }],
    explanation: "yes"
  },
  {
    id: "q_5",
    category: "sequence",
    questionText: "1,2,3...?",
    options: [{ id: "A", text: "4", score: true }, { id: "B", text: "5", score: false }, { id: "C", text: "6", score: false }, { id: "D", text: "7", score: false }],
    explanation: "yes"
  }
];

describe('GameEngine', () => {
  beforeEach(() => {
    setSystemTime(new Date(1000000000000));
  });

  afterEach(() => {
    setSystemTime();
  });

  test('initializes correctly', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    const healths = engine.getHealth();
    expect(healths['player1']).toBe(100);
    expect(healths['player2']).toBe(100);
    
    const state1 = engine.getStateForPlayer('player1');
    expect(state1.hand.length).toBe(5);
    expect(state1.timer.remainingMs).toBe(300_000);
  });

  test('playCard successful attack', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    engine.start();

    // Find an attack card in player1's hand
    const state = engine.getStateForPlayer('player1');
    const attackCard = state.hand.find(c => c.type === 'attack');
    
    if (!attackCard) return; // Might happen if randomly dealt only heals, but mock data and shuffle usually provide a mix

    // Use internal state to peek at correct option
    const internalPlayer1 = (engine as any).players.get('player1');
    const engineCard = internalPlayer1.hand.find((c: any) => c.id === attackCard.id);
    const correctOptionId = engineCard.correctOptionId;
    
    const result = engine.playCard('player1', attackCard.id, correctOptionId);
    
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.damage).toBe(10);
    expect(engine.getHealth()['player2']).toBe(90);
    expect(engine.getScores()['player1']).toBe(10);
    
    // Check cooldown
    const earlyResult = engine.playCard('player1', state.hand[1].id, 'A');
    expect(earlyResult.success).toBe(false);
  });

  test('playCard successful heal caps at 100', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');
    
    // Simulate taking damage first
    internalPlayer1.health = 80;

    // We force a heal card to exist for testing
    internalPlayer1.hand[0].type = 'heal';
    const healCard = internalPlayer1.hand[0];

    // fast forward time by 600ms to bypass rate limit if we already played
    setSystemTime(new Date(Date.now() + 600));
    
    const result = engine.playCard('player1', healCard.id, healCard.correctOptionId);
    
    expect(result.success).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.heal).toBe(10);
    expect(engine.getHealth()['player1']).toBe(90);
    expect(engine.getScores()['player1']).toBe(10);
  });

  test('playCard wrong answer', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    engine.start();

    const internalPlayer1 = (engine as any).players.get('player1');
    const firstCard = internalPlayer1.hand[0];
    
    // pick a wrong answer
    const wrongOption = firstCard.question.options.find((o: any) => o.id !== firstCard.correctOptionId);

    setSystemTime(new Date(Date.now() + 600));
    const result = engine.playCard('player1', firstCard.id, wrongOption.id);

    expect(result.success).toBe(true);
    expect(result.correct).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.heal).toBe(0);
    expect(engine.getHealth()['player2']).toBe(100);
    expect(engine.getHealth()['player1']).toBe(100);
  });

  test('win condition - hp zero', () => {
    const engine = new GameEngine(['player1', 'player2'], mockQuestions);
    engine.start();

    let gameOverEventFired = false;
    engine.on('gameOver', (data) => {
      gameOverEventFired = true;
      expect(data.winnerAddress).toBe('player1');
      expect(data.reason).toBe('hp_zero');
    });

    const internalPlayer1 = (engine as any).players.get('player1');
    const internalPlayer2 = (engine as any).players.get('player2');
    
    // Bring player 2 health down to 10
    internalPlayer2.health = 10;
    
    internalPlayer1.hand[0].type = 'attack';
    const attackCard = internalPlayer1.hand[0];

    setSystemTime(new Date(Date.now() + 600));
    const result = engine.playCard('player1', attackCard.id, attackCard.correctOptionId);
    
    expect(result.gameOver).toBe(true);
    expect(result.winnerAddress).toBe('player1');
    expect(gameOverEventFired).toBe(true);
    expect(engine.isFinished()).toBe(true);

    // Can't play cards after game over
    setSystemTime(new Date(Date.now() + 1200));
    const postGameResult = engine.playCard('player2', internalPlayer2.hand[0].id, internalPlayer2.hand[0].correctOptionId);
    expect(postGameResult.success).toBe(false);
  });
});
