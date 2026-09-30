import { supabase } from "@/integrations/supabase/client";
import { hhmm, type CoverContext, type CoverLesson, type CoverStaff } from "./cover";

export interface AwayTeacher {
  staffId: string;
  reason: string;
  /** "leave" when it comes from an approved leave request. */
  source: "leave" | "manual";
}

export interface AssignedCover {
  id: string;
  classId: string | null;
  startTime: string;
  endTime: string;
  coverStaffId: string | null;
  absentStaffId: string | null;
  subjectId: string | null;
  room: string | null;
  reason: string | null;
}

export interface CoverDay {
  date: string;
  weekday: number; // 1 = Monday
  lessons: CoverLesson[];
  staff: CoverStaff[];
  onLeave: AwayTeacher[];
  assigned: AssignedCover[];
  context: Omit<CoverContext, "away" | "assigned" | "dayLessons">;
  /** False when the cover table has not been set up in the database yet. */
  canSave: boolean;
}

/** Monday of the week containing the date (YYYY-MM-DD). */
function mondayOf(date: string) {
  const d = new Date(`${date}T12:00:00`);
  const back = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - back);
  return d.toISOString().slice(0, 10);
}
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
export const weekdayOf = (date: string) => {
  const js = new Date(`${date}T12:00:00`).getDay();
  return js === 0 ? 7 : js;
};

/** Everything the Cover Agent needs for one school day. */
export async function loadCoverDay(date: string): Promise<CoverDay> {
  const weekday = weekdayOf(date);
  const monday = mondayOf(date);
  const [entries, staff, allocs, subjects, leave, cover] = await Promise.all([
    supabase.from("timetable_entries").select("class_id, subject_id, teacher_id, day_of_week, start_time, end_time, room, classes(name)"),
    supabase.from("staff").select("id, full_name, department, subjects_taught, status").order("full_name"),
    supabase.from("class_subjects").select("class_id, subject_id, teacher_id"),
    supabase.from("subjects").select("id, name, department"),
    supabase.from("leave_requests").select("staff_id, leave_type, start_date, end_date, status").eq("status", "approved").lte("start_date", date).gte("end_date", date),
    supabase.from("timetable_cover").select("*").gte("cover_date", monday).lte("cover_date", addDays(monday, 6)).eq("status", "assigned"),
  ]);
  const err = entries.error ?? staff.error ?? allocs.error ?? subjects.error;
  if (err) throw err;

  const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const subjectDepartment = new Map((subjects.data ?? []).map((s) => [s.id, s.department]));
  const all = entries.data ?? [];
  // Older demo timetables number Monday as 0; published ones use 1.
  const zeroBased = all.some((e) => e.day_of_week === 0);
  const today = all.filter((e) => (zeroBased ? e.day_of_week + 1 : e.day_of_week) === weekday && e.class_id);
  const lessons: CoverLesson[] = today.map((e) => ({
    key: `${e.class_id}|${hhmm(e.start_time)}`,
    classId: e.class_id!,
    className: (e.classes as { name: string } | null)?.name ?? "Class",
    subjectId: e.subject_id,
    subjectName: e.subject_id ? subjectName.get(e.subject_id) ?? "Lesson" : "Lesson",
    teacherId: e.teacher_id,
    start: hhmm(e.start_time),
    end: hhmm(e.end_time),
    room: e.room,
  }));

  const teacherIds = new Set([...all.map((e) => e.teacher_id), ...(allocs.data ?? []).map((a) => a.teacher_id)].filter(Boolean) as string[]);
  const staffList: CoverStaff[] = (staff.data ?? [])
    .filter((s) => (teacherIds.has(s.id) || (s.subjects_taught?.length ?? 0) > 0) && !/inactive|left|terminated|resigned/i.test(s.status ?? ""))
    .map((s) => ({ id: s.id, name: s.full_name, department: s.department, subjectsTaught: s.subjects_taught ?? [] }));

  const teachesSubject = new Map<string, Set<string>>();
  const teachesClass = new Map<string, Set<string>>();
  for (const a of allocs.data ?? []) {
    if (!a.teacher_id) continue;
    if (a.subject_id) { if (!teachesSubject.has(a.teacher_id)) teachesSubject.set(a.teacher_id, new Set()); teachesSubject.get(a.teacher_id)!.add(a.subject_id); }
    if (a.class_id) { if (!teachesClass.has(a.teacher_id)) teachesClass.set(a.teacher_id, new Set()); teachesClass.get(a.teacher_id)!.add(a.class_id); }
  }

  const canSave = !cover.error;
  const weekRows = cover.data ?? [];
  const weekCover = new Map<string, number>();
  for (const r of weekRows) if (r.cover_staff_id && r.cover_date !== date) weekCover.set(r.cover_staff_id, (weekCover.get(r.cover_staff_id) ?? 0) + 1);
  const assigned: AssignedCover[] = weekRows
    .filter((r) => r.cover_date === date)
    .map((r) => ({
      id: r.id, classId: r.class_id, startTime: hhmm(r.start_time), endTime: hhmm(r.end_time),
      coverStaffId: r.cover_staff_id, absentStaffId: r.absent_staff_id, subjectId: r.subject_id, room: r.room, reason: r.reason,
    }));

  const onLeave: AwayTeacher[] = [];
  for (const l of leave.data ?? []) {
    if (l.staff_id && !onLeave.some((a) => a.staffId === l.staff_id)) onLeave.push({ staffId: l.staff_id, reason: `${l.leave_type} leave`, source: "leave" });
  }

  return {
    date,
    weekday,
    lessons,
    staff: staffList,
    onLeave,
    assigned,
    context: { staff: staffList, teachesSubject, teachesClass, subjectDepartment, weekCover },
    canSave,
  };
}

export interface CoverToSave {
  date: string;
  lesson: CoverLesson;
  coverStaffId: string;
  reason: string;
}

export async function saveCover(items: CoverToSave[]): Promise<void> {
  if (!items.length) return;
  const { error } = await supabase.from("timetable_cover").upsert(
    items.map((i) => ({
      cover_date: i.date,
      class_id: i.lesson.classId,
      subject_id: i.lesson.subjectId,
      start_time: i.lesson.start,
      end_time: i.lesson.end,
      room: i.lesson.room,
      absent_staff_id: i.lesson.teacherId,
      cover_staff_id: i.coverStaffId,
      reason: i.reason,
      status: "assigned",
    })),
    { onConflict: "cover_date,class_id,start_time" },
  );
  if (error) throw error;
}

export async function cancelCover(id: string): Promise<void> {
  const { error } = await supabase.from("timetable_cover").delete().eq("id", id);
  if (error) throw error;
}
