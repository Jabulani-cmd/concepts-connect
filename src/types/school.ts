import type { Tables } from "@/integrations/supabase/types";

/** Lightweight rows passed between portal screens (e.g. a teacher's classes and subjects). */
export type ClassOption = Pick<Tables<"classes">, "id" | "name" | "level">;
export type SubjectOption = Pick<Tables<"subjects">, "id" | "name">;
export type StudentOption = Pick<Tables<"students">, "id" | "full_name" | "admission_number" | "form">;
