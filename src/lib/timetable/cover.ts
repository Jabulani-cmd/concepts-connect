/**
 * Cover (substitute teacher) suggestions. For every lesson whose teacher is away,
 * ranks the teachers who are free at that time and picks one, so no one is asked
 * to be in two places at once and cover is shared fairly.
 */

export interface CoverLesson {
  /** Unique per lesson on the day (class + start time). */
  key: string;
  classId: string;
  className: string;
  subjectId: string | null;
  subjectName: string;
  teacherId: string | null;
  start: string; // "08:15"
  end: string;
  room: string | null;
}

export interface CoverStaff {
  id: string;
  name: string;
  department: string | null;
  subjectsTaught: string[];
}

export interface CoverContext {
  staff: CoverStaff[];
  /** Every lesson on the day, for the whole school (to know who is free). */
  dayLessons: CoverLesson[];
  /** Teachers who are away on the day. */
  away: Set<string>;
  /** Teacher id → subject ids they teach anywhere in the school. */
  teachesSubject: Map<string, Set<string>>;
  /** Teacher id → class ids they teach. */
  teachesClass: Map<string, Set<string>>;
  /** Subject id → department. */
  subjectDepartment: Map<string, string | null>;
  /** Cover already assigned on the day (including earlier suggestions). */
  assigned: { staffId: string; start: string; end: string }[];
  /** Cover lessons each teacher has done this week, for fairness. */
  weekCover: Map<string, number>;
}

export interface Candidate {
  staffId: string;
  name: string;
  score: number;
  reasons: string[];
}

export const hhmm = (t: string | null | undefined) => (t ?? "").slice(0, 5);
const toMin = (t: string) => {
  const [h, m] = hhmm(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  toMin(a.start) < toMin(b.end) && toMin(b.start) < toMin(a.end);

/** Teachers free for a lesson, best first. */
export function rankCover(lesson: CoverLesson, ctx: CoverContext): Candidate[] {
  const out: Candidate[] = [];
  const lessonsOf = new Map<string, CoverLesson[]>();
  for (const l of ctx.dayLessons) {
    if (!l.teacherId) continue;
    if (!lessonsOf.has(l.teacherId)) lessonsOf.set(l.teacherId, []);
    lessonsOf.get(l.teacherId)!.push(l);
  }
  const dept = lesson.subjectId ? ctx.subjectDepartment.get(lesson.subjectId) ?? null : null;
  const subjectWord = lesson.subjectName.toLowerCase();

  for (const s of ctx.staff) {
    if (s.id === lesson.teacherId || ctx.away.has(s.id)) continue;
    const mine = lessonsOf.get(s.id) ?? [];
    if (mine.some((l) => overlaps(l, lesson))) continue;
    if (ctx.assigned.some((a) => a.staffId === s.id && overlaps(a, lesson))) continue;

    let score = 50;
    const reasons: string[] = [];
    const teachesIt =
      (!!lesson.subjectId && ctx.teachesSubject.get(s.id)?.has(lesson.subjectId)) ||
      s.subjectsTaught.some((x) => x && subjectWord.includes(x.toLowerCase()));
    if (teachesIt) { score += 40; reasons.push(`teaches ${lesson.subjectName}`); }
    else if (dept && s.department && s.department.toLowerCase() === dept.toLowerCase()) { score += 15; reasons.push(`${dept} department`); }
    if (ctx.teachesClass.get(s.id)?.has(lesson.classId)) { score += 20; reasons.push(`already teaches ${lesson.className}`); }

    const teaching = mine.length;
    const coverToday = ctx.assigned.filter((a) => a.staffId === s.id).length;
    const week = ctx.weekCover.get(s.id) ?? 0;
    score -= teaching * 4 + coverToday * 12 + week * 6;
    reasons.push(`${teaching} lesson${teaching === 1 ? "" : "s"} today`);
    if (coverToday) reasons.push(`${coverToday} cover already today`);
    if (week) reasons.push(`${week} cover this week`);
    // Not teaching straight before and after gives them a breather.
    const back = mine.some((l) => hhmm(l.end) === hhmm(lesson.start)) && mine.some((l) => hhmm(l.start) === hhmm(lesson.end));
    if (back) { score -= 5; reasons.push("teaching either side"); }
    out.push({ staffId: s.id, name: s.name, score, reasons });
  }
  return out.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export interface CoverPlanItem {
  lesson: CoverLesson;
  suggestion: Candidate | null;
  alternatives: Candidate[];
}

/**
 * Suggests a substitute for every lesson that needs cover. Lessons with the fewest
 * free teachers are filled first, and each choice is counted before the next, so
 * nobody is suggested for two lessons at the same time and the load is shared.
 */
export function planCover(needCover: CoverLesson[], ctx: CoverContext): CoverPlanItem[] {
  const assigned = [...ctx.assigned];
  const weekCover = new Map(ctx.weekCover);
  const order = needCover
    .map((l) => ({ l, n: rankCover(l, { ...ctx, assigned, weekCover }).length }))
    .sort((a, b) => a.n - b.n || toMin(a.l.start) - toMin(b.l.start));
  const result = new Map<string, CoverPlanItem>();
  for (const { l } of order) {
    const ranked = rankCover(l, { ...ctx, assigned, weekCover });
    const pick = ranked[0] ?? null;
    if (pick) {
      assigned.push({ staffId: pick.staffId, start: l.start, end: l.end });
      weekCover.set(pick.staffId, (weekCover.get(pick.staffId) ?? 0) + 1);
    }
    result.set(l.key, { lesson: l, suggestion: pick, alternatives: ranked.slice(1, 6) });
  }
  return needCover.map((l) => result.get(l.key)!).sort((a, b) => toMin(a.lesson.start) - toMin(b.lesson.start) || a.lesson.className.localeCompare(b.lesson.className));
}
