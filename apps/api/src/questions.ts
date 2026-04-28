import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '@shared/question';
import { validateQuestion } from '@shared/question';

/**
 * Load and validate all question JSON files from the data/questions directory.
 * Called once at server startup and cached in memory.
 */
let cachedQuestions: Question[] | null = null;

export function loadQuestions(): Question[] {
  if (cachedQuestions) return cachedQuestions;

  const questionsDir = join(import.meta.dir, '..', '..', '..', 'data', 'questions');
  const files = readdirSync(questionsDir).filter(f => f.endsWith('.json'));

  const allQuestions: Question[] = [];

  for (const file of files) {
    const filePath = join(questionsDir, file);
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf-8'));
      const questions: unknown[] = Array.isArray(raw) ? raw : [raw];

      for (const q of questions) {
        if (validateQuestion(q)) {
          allQuestions.push(q);
        } else {
          console.warn(`Invalid question in ${file}:`, q);
        }
      }
    } catch (err) {
      console.error(`Failed to load questions from ${file}:`, err);
    }
  }

  console.log(`Loaded ${allQuestions.length} questions from ${files.length} file(s).`);
  cachedQuestions = allQuestions;
  return allQuestions;
}

/**
 * Force reload questions from disk (useful for dev hot-reload).
 */
export function reloadQuestions(): Question[] {
  cachedQuestions = null;
  return loadQuestions();
}
