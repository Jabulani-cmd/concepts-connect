// Family alerts and the daily school report for the school monitoring agent.
// Rules decide who is alerted and the wording is fixed and factual; AI only writes
// the principal's summary from school-wide numbers (never names).

export type SubjectAvg = { subject: string; avg: number; n: number };
export type Performance = {
  student_id: string;
  full_name: string;
  class_id: string;
  class_name: string;
  recent_avg: number | null;
  subjects: SubjectAvg[];
  marks_count: number;
  attendance_pct: number | null;
  days_absent: number;
  absent_today: boolean;
};
export type AlertSettings = { notify_parents: boolean; notify_students: boolean; low_mark: number; excellent_mark: number };

export const DEFAULT_ALERT_SETTINGS: AlertSettings = { notify_parents: true, notify_students: true, low_mark: 45, excellent_mark: 75 };

/** Enough marks to judge (at least three), and what they show. */
export function classify(p: Performance, s: AlertSettings) {
  const weak = p.subjects.filter((x) => x.avg < s.low_mark);
  const enough = p.marks_count >= 3 && p.recent_avg != null;
  const low = enough && (p.recent_avg! < s.low_mark || weak.length >= 2);
  const excellent = enough && p.subjects.length >= 3 && p.recent_avg! >= s.excellent_mark && weak.length === 0;
  const best = [...p.subjects].sort((a, b) => b.avg - a.avg)[0] ?? null;
  return { low, excellent, weak, best };
}

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || full;
const pct = (n: number) => `${Math.round(n)}%`;
const listSubjects = (xs: SubjectAvg[]) => xs.map((x) => `${x.subject} (${pct(x.avg)})`).join(", ");

export function niceDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

export type Message = { title: string; message: string; type: string; link: string };

export function parentAbsent(p: Performance, date: string): Message {
  const n = firstName(p.full_name);
  return {
    type: "child_absent",
    link: "/portal/parent-teacher",
    title: `${n} was absent today`,
    message: `${n} was marked absent from ${p.class_name} today (${niceDate(date)}). If you did not expect this, please contact the school office.`,
  };
}

export function parentSupport(p: Performance, s: AlertSettings): Message {
  const n = firstName(p.full_name);
  const { weak } = classify(p, s);
  return {
    type: "child_support",
    link: "/portal/parent-teacher",
    title: `${n} may need extra support`,
    message: `${n}'s average over the last four weeks is ${pct(p.recent_avg ?? 0)}.` +
      (weak.length ? ` Subjects needing attention: ${listSubjects(weak)}.` : "") +
      ` The class teacher has been asked to follow up. Please encourage ${n} at home and contact the school if you would like to discuss how to help.`,
  };
}

export function parentExcellent(p: Performance, s: AlertSettings): Message {
  const n = firstName(p.full_name);
  const { best } = classify(p, s);
  return {
    type: "child_excellent",
    link: "/portal/parent-teacher",
    title: `Well done, ${n}!`,
    message: `${n} is performing very well, with an average of ${pct(p.recent_avg ?? 0)} over the last four weeks` +
      (best ? ` (best: ${best.subject}, ${pct(best.avg)})` : "") + `. Please congratulate ${n} from all of us at the school.`,
  };
}

export function studentSupport(p: Performance, s: AlertSettings): Message {
  const { weak } = classify(p, s);
  return {
    type: "progress_support",
    link: "/portal/student",
    title: "Let's get your marks up",
    message: (weak.length
      ? `Your recent marks in ${listSubjects(weak)} are below ${s.low_mark}%.`
      : `Your average over the last four weeks is ${pct(p.recent_avg ?? 0)}.`) +
      " Ask your teachers for help, redo the practice questions, and use the study materials and AI tutor in your portal. You can do this!",
  };
}

export function studentExcellent(p: Performance, s: AlertSettings): Message {
  const { best } = classify(p, s);
  return {
    type: "progress_praise",
    link: "/portal/student",
    title: "Excellent work!",
    message: `Your average over the last four weeks is ${pct(p.recent_avg ?? 0)}` + (best ? `, with ${pct(best.avg)} in ${best.subject}` : "") + ". Keep it up!",
  };
}

/** Keys that stop the same alert being sent twice: absence per day, support every two weeks, praise every month. */
export function alertKey(kind: "absent" | "support" | "excellent", studentId: string, date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  if (kind === "absent") return `absent:${studentId}:${date}`;
  if (kind === "excellent") return `excellent:${studentId}:${date.slice(0, 7)}`;
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  const fortnight = Math.floor((d.getTime() - start) / (14 * 86400000));
  return `support:${studentId}:${d.getUTCFullYear()}-F${fortnight}`;
}

export type TeacherAway = { name: string; reason: string; lessons: number; covered: number };
export type Debtor = { name: string; class_name: string; balance: number };

export type DailyReport = {
  date: string;
  generated_at: string;
  attendance: {
    registers_taken: number; classes: number; present_pct: number | null; absent_today: number;
    absent: { name: string; class_name: string }[];
    chronic: { name: string; class_name: string; attendance_pct: number }[];
  };
  performance: {
    learners_with_marks: number; school_avg: number | null; at_risk: number;
    low: { name: string; class_name: string; avg: number; weak: string }[];
    excellent: { name: string; class_name: string; avg: number }[];
  };
  teachers: { away: TeacherAway[]; lessons_needing_cover: number };
  fees: { overdue_invoices: number; learners_owing: number; total_usd: number; top_debtors: Debtor[] };
  open_items: Record<string, number>;
};

/** The numbers the principal's summary is written from (no names). */
export function reportCounts(r: DailyReport) {
  return {
    registers: `${r.attendance.registers_taken}/${r.attendance.classes}`,
    present_pct: r.attendance.present_pct,
    absent_today: r.attendance.absent_today,
    chronic_absentees: r.attendance.chronic.length,
    school_avg: r.performance.school_avg,
    low_performers: r.performance.low.length,
    at_risk: r.performance.at_risk,
    excellent: r.performance.excellent.length,
    teachers_away: r.teachers.away.length,
    lessons_needing_cover: r.teachers.lessons_needing_cover,
    overdue_invoices: r.fees.overdue_invoices,
    learners_owing: r.fees.learners_owing,
    fees_outstanding_usd: r.fees.total_usd,
  };
}

/** A plain summary for when AI is not available. */
export function ruleSummary(r: DailyReport): string {
  const lines: string[] = [];
  const a = r.attendance;
  lines.push(a.classes
    ? `Registers taken in ${a.registers_taken} of ${a.classes} classes${a.present_pct != null ? `; ${a.present_pct}% of learners present` : ""}; ${a.absent_today} absent today.`
    : "No class registers yet today.");
  if (a.chronic.length) lines.push(`${a.chronic.length} learner${a.chronic.length === 1 ? " has" : "s have"} attendance below 80% over the last four weeks.`);
  const p = r.performance;
  if (p.learners_with_marks) {
    lines.push(`School average over four weeks: ${p.school_avg ?? "-"}%. ${p.low.length} learner${p.low.length === 1 ? " is" : "s are"} performing below the support mark and ${p.excellent.length} ${p.excellent.length === 1 ? "is" : "are"} excelling.`);
  }
  if (r.teachers.away.length) {
    lines.push(`${r.teachers.away.length} teacher${r.teachers.away.length === 1 ? " is" : "s are"} away; ${r.teachers.lessons_needing_cover} lesson${r.teachers.lessons_needing_cover === 1 ? " still needs" : "s still need"} cover.`);
  }
  if (r.fees.overdue_invoices) lines.push(`US$ ${r.fees.total_usd.toFixed(2)} outstanding on ${r.fees.overdue_invoices} invoices more than 30 days overdue (${r.fees.learners_owing} learners).`);
  return lines.join("\n");
}
