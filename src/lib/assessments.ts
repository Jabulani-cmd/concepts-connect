import type { Json } from "@/integrations/supabase/types";

/** A multiple-choice question as stored in assessments.questions. */
export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
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
