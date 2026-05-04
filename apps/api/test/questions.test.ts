import { test, expect, describe, beforeEach } from 'bun:test';
import { loadQuestions, reloadQuestions } from '../src/questions';

describe('questions loader', () => {
  beforeEach(() => {
    // Force fresh load for each test
    reloadQuestions();
  });

  test('loads questions from data directory', () => {
    const questions = loadQuestions();
    expect(questions.length).toBeGreaterThan(0);
  });

  test('all loaded questions have required fields', () => {
    const questions = loadQuestions();
    for (const q of questions) {
      expect(typeof q.id).toBe('string');
      expect(['sequence', 'logical', 'math']).toContain(q.category);
      expect(typeof q.questionText).toBe('string');
      expect(q.options).toHaveLength(4);

      // Exactly one correct answer
      const correct = q.options.filter(o => o.score === true);
      expect(correct).toHaveLength(1);

      // Each option has id, text, score
      for (const opt of q.options) {
        expect(typeof opt.id).toBe('string');
        expect(typeof opt.text).toBe('string');
        expect(typeof opt.score).toBe('boolean');
      }

      expect(typeof q.explanation).toBe('string');
    }
  });

  test('caches on second call (same reference)', () => {
    const q1 = loadQuestions();
    const q2 = loadQuestions();
    expect(q1).toBe(q2); // Same array reference
  });

  test('reloadQuestions clears cache and reloads', () => {
    const q1 = loadQuestions();
    const q2 = reloadQuestions();
    // After reload, should be a fresh array (different reference)
    expect(q1).not.toBe(q2);
    // But same content
    expect(q1.length).toBe(q2.length);
  });
});
