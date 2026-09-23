import { supabase } from "@/integrations/supabase/client";

/** Calls the secure AI edge function. API keys never touch the browser. */
export async function callTeacherAi<T>(kind: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("teacher-ai-suite", {
    body: { kind, payload },
  });
  if (error) throw new Error(error.message || "AI request failed");
  if (data?.error) throw new Error(data.error);
  return data?.result as T;
}

export const ZIM_LEVELS = [
  "Form 1", "Form 2", "Form 3", "Form 4", "Lower 6", "Upper 6",
];

export const ZIM_SUBJECTS = [
  "Mathematics", "English Language", "Combined Science", "Biology", "Chemistry", "Physics",
  "Geography", "History", "Shona", "Ndebele", "Accounting", "Business Studies",
  "Computer Science", "Agriculture", "Heritage Studies",
];
