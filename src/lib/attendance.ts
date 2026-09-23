import { supabase } from "@/integrations/supabase/client";

/**
 * Saves one day's attendance register for a class.
 * Existing rows for the class and date are updated; the rest are inserted.
 *
 * @param statuses map of student id to status ("present", "absent", "late", ...)
 */
export async function saveClassAttendance(
  classId: string,
  date: string,
  statuses: Record<string, string>,
  recordedBy: string | null,
): Promise<void> {
  const { data: existing, error: readError } = await supabase
    .from("attendance")
    .select("id, student_id")
    .eq("class_id", classId)
    .eq("date", date);
  if (readError) throw readError;

  const existingIdByStudent = new Map((existing ?? []).map(r => [r.student_id, r.id]));

  const toInsert = Object.entries(statuses)
    .filter(([studentId]) => !existingIdByStudent.has(studentId))
    .map(([studentId, status]) => ({ student_id: studentId, class_id: classId, date, status, recorded_by: recordedBy }));
  if (toInsert.length > 0) {
    const { error } = await supabase.from("attendance").insert(toInsert);
    if (error) throw error;
  }

  // One update per distinct status rather than one per student.
  const idsByStatus = new Map<string, string[]>();
  for (const [studentId, status] of Object.entries(statuses)) {
    const id = existingIdByStudent.get(studentId);
    if (id) idsByStatus.set(status, [...(idsByStatus.get(status) ?? []), id]);
  }
  for (const [status, ids] of idsByStatus) {
    const { error } = await supabase.from("attendance").update({ status, recorded_by: recordedBy }).in("id", ids);
    if (error) throw error;
  }
}
