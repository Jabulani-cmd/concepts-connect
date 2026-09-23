import type { Tables } from "@/integrations/supabase/types";

/** Lightweight rows passed between portal screens (e.g. a teacher's classes and subjects). */
export type ClassOption = Pick<Tables<"classes">, "id" | "name" | "level">;
export type SubjectOption = Pick<Tables<"subjects">, "id" | "name">;
export type StudentOption = Pick<Tables<"students">, "id" | "full_name" | "admission_number" | "form">;

/** Result of the get_exam_rankings database function. */
export type ExamRankings = {
  overall_rank?: number;
  total_students?: number;
  subject_rankings?: Record<string, { rank: number; total: number }> | null;
};
