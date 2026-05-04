export interface Option {
  /**
   * Identifier for the answer option.
   * Usually uses "A", "B", "C", "D".
   */
  id: string;

  /**
   * Text of the answer option.
   */
  text: string;

  /**
   * Determines whether this option is the correct answer.
   */
  score: boolean;
}

export interface Question {
  /**
   * Unique identifier for each question.
   * Recommended format: q_[category]_[number].
   */
  id: string;

  /**
   * The category of the question.
   */
  category: "sequence" | "logical" | "math";

  /**
   * Main text of the question.
   */
  questionText: string;

  /**
   * List of multiple choices for the question.
   * Must contain exactly 4 Option objects.
   */
  options: [Option, Option, Option, Option];

  /**
   * Explanation or method of solving the question.
   */
  explanation: string;
}

/**
 * Basic validation to ensure the object satisfies the Question schema.
 * Useful when parsing JSON response from the Agent.
 */
export function validateQuestion(data: any): data is Question {
  if (!data || typeof data !== "object") return false;

  if (typeof data.id !== "string") return false;
  
  if (!["sequence", "logical", "math"].includes(data.category)) return false;
  
  if (typeof data.questionText !== "string") return false;
  
  if (!Array.isArray(data.options) || data.options.length !== 4) return false;
  
  const optionsValid = data.options.every((opt: any) => {
    return (
      typeof opt === "object" &&
      typeof opt.id === "string" &&
      typeof opt.text === "string" &&
      typeof opt.score === "boolean"
    );
  });
  if (!optionsValid) return false;

  const correctAnswersCount = data.options.filter((opt: any) => opt.score === true).length;
  if (correctAnswersCount !== 1) return false;

  if (typeof data.explanation !== "string") return false;

  return true;
}
