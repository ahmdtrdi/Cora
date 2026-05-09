import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '@shared/question';
import { validateQuestion } from '@shared/question';
import { supabase } from './services/supabase';

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

/**
 * Fetch a perfectly balanced set of questions per match from Supabase.
 * Falls back to local JSON if the database fails.
 */
export async function fetchMatchQuestions(): Promise<Question[]> {
  try {
    // 1. Fetch the 60 raw questions from the DB
    const { data: selected, error } = await supabase.rpc('get_match_deck');

    if (error) {
      console.error('Supabase RPC Error in fetchMatchQuestions:', error);
      throw error;
    }
    
    if (!selected || selected.length === 0) {
      console.warn('Supabase returned 0 questions, falling back to local JSON...');
      return loadQuestions();
    }

    // 2. Validate and Map to TypeScript Interface
    const validated: Question[] = [];
    for (const raw of selected) {
      const mapped = {
        ...raw,
        questionText: raw.questionText || raw.question_text
      };
      
      if (validateQuestion(mapped)) {
        validated.push(mapped as Question);
      } else {
        console.warn('Failed validation on mapped question:', mapped);
      }
    }
    
    if (validated.length === 0) {
       console.warn('Supabase questions failed validation, falling back to local JSON...');
       return loadQuestions();
    }

    // 3. The "Bag Shuffle" Algorithm
    const math = validated.filter(q => q.category === 'math');
    const logical = validated.filter(q => q.category === 'logical');
    const sequence = validated.filter(q => q.category === 'sequence');

    const masterDeck: Question[] = [];
    const deckSize = Math.max(math.length, logical.length, sequence.length);

    for (let i = 0; i < deckSize; i++) {
      const miniBatch: Question[] = [];
      
      // Pull one of each category into the bag
      if (math[i]) miniBatch.push(math[i]);
      if (logical[i]) miniBatch.push(logical[i]);
      if (sequence[i]) miniBatch.push(sequence[i]);
      
      // Shuffle the bag
      miniBatch.sort(() => Math.random() - 0.5);
      
      // Add the shuffled bag to the deck
      masterDeck.push(...miniBatch);
    }
    
    return masterDeck;
  } catch (err) {
    console.error('Error in fetchMatchQuestions:', err);
    console.warn('Falling back to local pool...');
    return loadQuestions(); // Fallback
  }
}
