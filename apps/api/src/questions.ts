import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Question } from '@shared/question';
import { validateQuestion } from '@shared/question';
import { createClient } from '@supabase/supabase-js';

// Setup Supabase client
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
    const { data: selected, error } = await supabase.rpc('get_distributed_questions');

    if (error) {
      console.error('Supabase RPC Error in fetchMatchQuestions:', error);
      throw error;
    }
    
    if (!selected || selected.length === 0) {
      console.warn('Supabase returned 0 questions, falling back to local JSON...');
      return loadQuestions();
    }

    const validated: Question[] = [];
    for (const raw of selected) {
      // Map postgres snake_case to typescript camelCase if needed
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
    
    return validated;
  } catch (err) {
    console.error('Error in fetchMatchQuestions:', err);
    console.warn('Falling back to local pool...');
    return loadQuestions(); // Fallback
  }
}
