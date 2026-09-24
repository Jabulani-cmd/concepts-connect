import type { Json } from "@/integrations/supabase/types";

/**
 * A multiple-choice question. Teachers send the answer (correct_index) and
 * explanation when saving; the database moves them into assessment_answer_keys,
 * so questions read back from assessments.questions never include them.
 */
export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_index?: number;
  explanation?: string;
  marks?: number;
};

/** Reads assessments.questions (JSON) into typed questions, skipping malformed entries. */
export function parseQuestions(value: Json | null | undefined): QuizQuestion[] {
  if (!Array.isArray(value)) return [];
  return value.filter((q): q is QuizQuestion & Json => {
    if (!q || typeof q !== "object" || Array.isArray(q)) return false;
    return typeof q.id === "string" && typeof q.question === "string" && Array.isArray(q.options);
  }) as QuizQuestion[];
}

/** What submit_quiz returns after marking a quiz on the server. */
export type QuizResult = { mark: number; total: number; percentage: number; grade: string; passed: boolean };

export function parseQuizResult(value: Json | null | undefined): QuizResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { mark, total, percentage, grade, passed } = value;
  if (typeof grade !== "string") return null;
  return { mark: Number(mark) || 0, total: Number(total) || 0, percentage: Number(percentage) || 0, grade, passed: passed === true };
}
