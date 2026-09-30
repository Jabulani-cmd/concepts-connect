import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { buildPeriodSchedule, colorForSubject, type BreakSpec, type PeriodTimes } from "@/lib/timetableUtils";
import type { LessonRequirement, Placement, SolverInput } from "./solver";

/** The school's timetable settings, kept in site_settings so they are there next time. */
export interface TimetablePlan {
  version: 1;
  termLabel: string;
  academicYear: string;
  days: number[];
  dayStart: string;
  periodMinutes: number;
  periodsPerDay: number;
  breaks: BreakSpec[];
  /** Periods per week for a subject in every class ("subjectId"), or for one class ("classId:subjectId"). */
  periods: Record<string, number>;
  /** Specialist rooms and the subjects that must be taught in them. */
  venues: { name: string; subjectIds: string[] }[];
  /** Staff id → days (1 = Monday) they do not teach, e.g. part-time staff. */
  daysOff: Record<string, number[]>;
  /** Subjects kept in the morning where possible. */
  morningSubjectIds: string[];
}

export const PLAN_KEY = "timetable:plan";

export interface SchoolClass { id: string; name: string; form: number | null; room: string | null }
export interface SchoolSubject { id: string; name: string; department: string | null }
export interface SchoolTeacher { id: string; name: string; department: string | null; subjectsTaught: string[] }
export interface Allocation { classId: string; subjectId: string; teacherId: string | null }

export interface SchoolData {
  classes: SchoolClass[];
  subjects: SchoolSubject[];
  teachers: SchoolTeacher[];
  allocations: Allocation[];
}

export function formOf(c: { name: string; level?: string | null }): number | null {
  const m = `${c.level ?? ""} ${c.name}`.match(/(?:form|grade)\s*(\d)/i) ?? c.name.match(/(\d)/);
  if (/lower\s*6|l6/i.test(c.name)) return 5;
  if (/upper\s*6|u6/i.test(c.name)) return 6;
  return m ? Number(m[1]) : null;
}

/** Usual weekly periods for a subject in a Zimbabwean secondary school (40 periods a week). */
export function defaultPeriods(subjectName: string, form: number | null): number {
  const n = subjectName.toLowerCase();
  const aLevel = (form ?? 0) >= 5;
  if (aLevel) return /general paper|communication skills/.test(n) ? 2 : /physical education|sport|guidance/.test(n) ? 1 : 6;
  if (/^math|mathematics/.test(n)) return 6;
  if (/english/.test(n)) return 5;
  if (/combined science|integrated science|^science/.test(n)) return 5;
  if (/shona|ndebele|tonga|venda|kalanga|french|portuguese/.test(n)) return 4;
  if (/physics|chemistry|biology|accounts|accounting|computer|ict/.test(n)) return 4;
  if (/physical education|sport|guidance|counselling|library|assembly/.test(n)) return 2;
  if (/heritage|religious|family|fashion|music|art|history|geography|commerce|agric/.test(n)) return 3;
  return 3;
}

export function defaultPlan(): TimetablePlan {
  const year = new Date().getFullYear();
  return {
    version: 1,
    termLabel: "Term 1",
    academicYear: String(year),
    days: [1, 2, 3, 4, 5],
    dayStart: "07:30",
    periodMinutes: 40,
    periodsPerDay: 8,
    breaks: [
      { afterPeriod: 2, label: "Break", minutes: 20 },
      { afterPeriod: 5, label: "Lunch", minutes: 40 },
    ],
    periods: {},
    venues: [],
    daysOff: {},
    morningSubjectIds: [],
  };
}

export async function loadPlan(): Promise<TimetablePlan> {
  const { data } = await supabase.from("site_settings").select("setting_value").eq("setting_key", PLAN_KEY).maybeSingle();
  if (!data?.setting_value) return defaultPlan();
  try {
    return { ...defaultPlan(), ...(JSON.parse(data.setting_value) as Partial<TimetablePlan>) };
  } catch {
    return defaultPlan();
  }
}

export async function savePlan(plan: TimetablePlan): Promise<void> {
  const value = JSON.stringify(plan);
  const { data: existing } = await supabase.from("site_settings").select("id").eq("setting_key", PLAN_KEY);
  const { error } = existing?.length
    ? await supabase.from("site_settings").update({ setting_value: value, updated_at: new Date().toISOString() }).eq("setting_key", PLAN_KEY)
    : await supabase.from("site_settings").insert({ setting_key: PLAN_KEY, setting_value: value });
  if (error) throw error;
}

/** Classes, subjects, teachers and who teaches what, from the school's records. */
export async function loadSchool(): Promise<SchoolData> {
  const [cls, subs, staff, alloc] = await Promise.all([
    supabase.from("classes").select("id, name, level, room").order("name"),
    supabase.from("subjects").select("id, name, department").order("name"),
    supabase.from("staff").select("id, full_name, department, subjects_taught, status").order("full_name"),
    supabase.from("class_subjects").select("class_id, subject_id, teacher_id"),
  ]);
  const err = cls.error ?? subs.error ?? staff.error ?? alloc.error;
  if (err) throw err;
  return {
    classes: (cls.data ?? []).map((c) => ({ id: c.id, name: c.name, form: formOf(c), room: c.room })),
    subjects: (subs.data ?? []).map((s) => ({ id: s.id, name: s.name, department: s.department })),
    teachers: (staff.data ?? [])
      .filter((s) => !s.status || !/inactive|left|terminated|resigned/i.test(s.status))
      .map((s) => ({ id: s.id, name: s.full_name, department: s.department, subjectsTaught: s.subjects_taught ?? [] })),
    allocations: (alloc.data ?? [])
      .filter((a) => a.class_id && a.subject_id)
      .map((a) => ({ classId: a.class_id!, subjectId: a.subject_id!, teacherId: a.teacher_id })),
  };
}

export function periodsFor(plan: TimetablePlan, school: SchoolData, a: Allocation): number {
  const own = plan.periods[`${a.classId}:${a.subjectId}`];
  if (own !== undefined) return own;
  const all = plan.periods[a.subjectId];
  if (all !== undefined) return all;
  const subject = school.subjects.find((s) => s.id === a.subjectId);
  const cls = school.classes.find((c) => c.id === a.classId);
  return defaultPeriods(subject?.name ?? "", cls?.form ?? null);
}

/** Turns the school's allocations and the plan into solver input. */
export function buildSolverInput(school: SchoolData, plan: TimetablePlan): SolverInput {
  const venueFor = new Map<string, string[]>();
  for (const v of plan.venues) for (const s of v.subjectIds) venueFor.set(s, [...(venueFor.get(s) ?? []), v.name]);
  const morning = new Set(plan.morningSubjectIds);
  const lessons: LessonRequirement[] = school.allocations.map((a) => ({
    id: `${a.classId}:${a.subjectId}`,
    classId: a.classId,
    subjectId: a.subjectId,
    teacherId: a.teacherId,
    periodsPerWeek: periodsFor(plan, school, a),
    venues: venueFor.get(a.subjectId) ?? [],
    morning: morning.has(a.subjectId),
  }));
  const teacherUnavailable: Record<string, string[]> = {};
  for (const [t, days] of Object.entries(plan.daysOff)) if (days.length) teacherUnavailable[t] = days.map((d) => `${d}-*`);
  return { days: plan.days, periodsPerDay: plan.periodsPerDay, lessons, teacherUnavailable };
}

export function schedule(plan: TimetablePlan): PeriodTimes[] {
  return buildPeriodSchedule(plan.dayStart, plan.periodMinutes, plan.periodsPerDay, plan.breaks);
}

const chunks = <T,>(rows: T[], n: number) => Array.from({ length: Math.ceil(rows.length / n) }, (_, i) => rows.slice(i * n, i * n + n));

/**
 * Publishes the timetable: replaces each class's weekly lessons (what students,
 * parents and teachers see) and its printable timetable grid.
 */
export async function publishTimetable(school: SchoolData, plan: TimetablePlan, placements: Placement[]): Promise<number> {
  const times = schedule(plan).filter((p) => !p.isBreak);
  const term = `${plan.termLabel} ${plan.academicYear}`.trim();
  const subjectName = new Map(school.subjects.map((s) => [s.id, s.name]));
  const teacherName = new Map(school.teachers.map((t) => [t.id, t.name]));
  const classById = new Map(school.classes.map((c) => [c.id, c]));
  const classIds = [...new Set(placements.map((p) => p.classId))];

  // Weekly lessons for the portals.
  const { error: delErr } = await supabase.from("timetable_entries").delete().in("class_id", classIds);
  if (delErr) throw delErr;
  const entries: TablesInsert<"timetable_entries">[] = placements.map((p) => ({
    class_id: p.classId,
    subject_id: p.subjectId,
    teacher_id: p.teacherId,
    day_of_week: p.day,
    start_time: times[p.period].start,
    end_time: times[p.period].end,
    room: p.venue ?? classById.get(p.classId)?.room ?? null,
    term,
  }));
  for (const rows of chunks(entries, 200)) {
    const { error } = await supabase.from("timetable_entries").insert(rows);
    if (error) throw error;
  }

  // Printable class timetables.
  const sched = schedule(plan);
  for (const classId of classIds) {
    const cls = classById.get(classId);
    if (!cls) continue;
    await supabase.from("tt_definitions").update({ status: "archived" }).eq("class_label", cls.name).eq("status", "active");
    await supabase.from("tt_definitions").delete().eq("class_label", cls.name).contains("settings", { source: "timetable-agent" });
    const { data: def, error: defErr } = await supabase
      .from("tt_definitions")
      .insert({
        name: `${cls.name} timetable`,
        type: "class",
        class_label: cls.name,
        term: plan.termLabel,
        academic_year: plan.academicYear,
        school_days: plan.days,
        period_minutes: plan.periodMinutes,
        periods_per_day: plan.periodsPerDay,
        day_start_time: plan.dayStart,
        breaks: plan.breaks as unknown as TablesInsert<"tt_definitions">["breaks"],
        settings: { source: "timetable-agent" },
        status: "active",
      })
      .select("id")
      .single();
    if (defErr) throw defErr;
    const slots: TablesInsert<"tt_slots">[] = [];
    for (const day of plan.days) {
      sched.forEach((p, i) => {
        if (p.isBreak) {
          slots.push({ definition_id: def.id, day_of_week: day, period_index: -100 - day * 10 - i, start_time: p.start, end_time: p.end, is_break: true, break_label: p.label ?? null });
          return;
        }
        const lesson = placements.find((x) => x.classId === classId && x.day === day && x.period === p.index);
        const name = lesson ? subjectName.get(lesson.subjectId) ?? null : null;
        slots.push({
          definition_id: def.id,
          day_of_week: day,
          period_index: p.index,
          start_time: p.start,
          end_time: p.end,
          is_break: false,
          subject_name: name,
          subject_color: name ? colorForSubject(name) : null,
          teacher_name: lesson?.teacherId ? teacherName.get(lesson.teacherId) ?? null : null,
          room: lesson ? lesson.venue ?? cls.room ?? null : null,
        });
      });
    }
    const { error } = await supabase.from("tt_slots").insert(slots);
    if (error) throw error;
  }
  return entries.length;
}
