/**
 * Whole-school timetable solver. Places every lesson of every class in one pass so
 * that no teacher, class or specialist room is ever booked twice at the same time,
 * then checks the result independently with `findClashes`.
 *
 * Hard rules (never broken): one lesson per class per period; one lesson per
 * teacher per period; one class per specialist room per period; teachers are not
 * timetabled when they are unavailable; each subject gets exactly its periods.
 * Soft goals: spread a subject across the week, keep marked subjects in the
 * morning, and even out each teacher's day.
 */

export interface LessonRequirement {
  /** Unique per class and subject. */
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  periodsPerWeek: number;
  /** Specialist rooms this subject must use (any one of them); empty means the class's own room. */
  venues?: string[];
  /** Prefer the first half of the day (e.g. Mathematics, English). */
  morning?: boolean;
}

export interface SolverInput {
  /** School days, 1 = Monday. */
  days: number[];
  /** Teaching periods per day, numbered 0 … periodsPerDay - 1. */
  periodsPerDay: number;
  lessons: LessonRequirement[];
  /** Teacher id → "day-period" keys (or "day-*" for a whole day) when they cannot teach. */
  teacherUnavailable?: Record<string, string[]>;
  /** Most periods of one subject a class has on one day (default: spread evenly, at most 2). */
  maxPerDay?: number;
  seed?: number;
  /** How many different orderings to try before giving up on a perfect timetable. */
  attempts?: number;
}

export interface Placement {
  lessonId: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  day: number;
  period: number;
  venue: string | null;
}

export interface Unplaced {
  lessonId: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  missing: number;
}

export interface Problem {
  kind: "teacher_overloaded" | "class_overfull" | "venue_overbooked" | "no_teacher";
  message: string;
  ids: string[];
}

export interface SolverResult {
  placements: Placement[];
  unplaced: Unplaced[];
  problems: Problem[];
  attempts: number;
}

export interface Clash {
  kind: "class" | "teacher" | "venue" | "count" | "unavailable";
  day?: number;
  period?: number;
  message: string;
}

type Rng = () => number;
function rng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const key = (a: string, day: number, period: number) => `${a}|${day}|${period}`;

/** Things that make a clash-free timetable impossible, found before solving. */
export function checkFeasibility(input: SolverInput): Problem[] {
  const slotsPerWeek = input.days.length * input.periodsPerDay;
  const problems: Problem[] = [];
  const teacherLoad = new Map<string, number>();
  const classLoad = new Map<string, number>();
  const venueLoad = new Map<string, number>();
  for (const l of input.lessons) {
    if (!l.teacherId) problems.push({ kind: "no_teacher", message: "A subject has no teacher allocated.", ids: [l.id] });
    else teacherLoad.set(l.teacherId, (teacherLoad.get(l.teacherId) ?? 0) + l.periodsPerWeek);
    classLoad.set(l.classId, (classLoad.get(l.classId) ?? 0) + l.periodsPerWeek);
    if (l.venues?.length) {
      const group = [...l.venues].sort().join("+");
      venueLoad.set(group, (venueLoad.get(group) ?? 0) + l.periodsPerWeek);
    }
  }
  for (const [t, n] of teacherLoad) {
    const blocked = (input.teacherUnavailable?.[t] ?? []).reduce((sum, k) => sum + (k.endsWith("-*") ? input.periodsPerDay : 1), 0);
    const available = slotsPerWeek - blocked;
    if (n > available) problems.push({ kind: "teacher_overloaded", message: `needs ${n} periods but only ${available} are available in the week`, ids: [t] });
  }
  for (const [c, n] of classLoad) {
    if (n > slotsPerWeek) problems.push({ kind: "class_overfull", message: `has ${n} lessons but the week only has ${slotsPerWeek} periods`, ids: [c] });
  }
  for (const [g, n] of venueLoad) {
    const rooms = g.split("+").length;
    if (n > rooms * slotsPerWeek) problems.push({ kind: "venue_overbooked", message: `${g} is needed for ${n} periods but has room for ${rooms * slotsPerWeek}`, ids: g.split("+") });
  }
  return problems;
}

function solveOnce(input: SolverInput, random: Rng): { placements: Placement[]; unplaced: Unplaced[] } {
  const { days, periodsPerDay } = input;
  const byId = new Map(input.lessons.map((l) => [l.id, l]));
  const classBusy = new Map<string, string>(); // class|d|p → placement index key
  const teacherBusy = new Map<string, string>();
  const venueBusy = new Map<string, string>();
  const placed = new Map<string, Placement>(); // placement key → placement
  const perDay = new Map<string, number>(); // lessonId|day → count
  const teacherDay = new Map<string, number>(); // teacher|day → count
  const blocked = new Set<string>();
  for (const [t, keys] of Object.entries(input.teacherUnavailable ?? {})) {
    for (const k of keys) {
      const [d, p] = k.split("-");
      if (p === "*") for (let i = 0; i < periodsPerDay; i++) blocked.add(key(t, Number(d), i));
      else blocked.add(key(t, Number(d), Number(p)));
    }
  }
  const cap = (l: LessonRequirement, extra = 0) =>
    Math.min(input.maxPerDay ?? 2, Math.max(1, Math.ceil(l.periodsPerWeek / days.length))) + extra;

  let seq = 0;
  const put = (l: LessonRequirement, day: number, period: number, venue: string | null) => {
    const id = `p${seq++}`;
    const p: Placement = { lessonId: l.id, classId: l.classId, subjectId: l.subjectId, teacherId: l.teacherId, day, period, venue };
    placed.set(id, p);
    classBusy.set(key(l.classId, day, period), id);
    if (l.teacherId) teacherBusy.set(key(l.teacherId, day, period), id);
    if (venue) venueBusy.set(key(venue, day, period), id);
    perDay.set(`${l.id}|${day}`, (perDay.get(`${l.id}|${day}`) ?? 0) + 1);
    if (l.teacherId) teacherDay.set(`${l.teacherId}|${day}`, (teacherDay.get(`${l.teacherId}|${day}`) ?? 0) + 1);
    return id;
  };
  const remove = (id: string) => {
    const p = placed.get(id)!;
    placed.delete(id);
    classBusy.delete(key(p.classId, p.day, p.period));
    if (p.teacherId) teacherBusy.delete(key(p.teacherId, p.day, p.period));
    if (p.venue) venueBusy.delete(key(p.venue, p.day, p.period));
    perDay.set(`${p.lessonId}|${p.day}`, (perDay.get(`${p.lessonId}|${p.day}`) ?? 1) - 1);
    if (p.teacherId) teacherDay.set(`${p.teacherId}|${p.day}`, (teacherDay.get(`${p.teacherId}|${p.day}`) ?? 1) - 1);
    return p;
  };
  const freeVenue = (l: LessonRequirement, day: number, period: number) => {
    if (!l.venues?.length) return null;
    return l.venues.find((v) => !venueBusy.has(key(v, day, period))) ?? undefined;
  };
  const teacherFree = (l: LessonRequirement, day: number, period: number) =>
    !l.teacherId || (!teacherBusy.has(key(l.teacherId, day, period)) && !blocked.has(key(l.teacherId, day, period)));

  /** Best open slot for a lesson, or null. */
  const bestSlot = (l: LessonRequirement, capExtra: number) => {
    let best: { day: number; period: number; venue: string | null; score: number } | null = null;
    for (const day of days) {
      const today = perDay.get(`${l.id}|${day}`) ?? 0;
      if (today >= cap(l, capExtra)) continue;
      for (let period = 0; period < periodsPerDay; period++) {
        if (classBusy.has(key(l.classId, day, period)) || !teacherFree(l, day, period)) continue;
        const venue = freeVenue(l, day, period);
        if (venue === undefined) continue;
        let score = today * 10;
        score += (l.teacherId ? teacherDay.get(`${l.teacherId}|${day}`) ?? 0 : 0) * 1.5;
        if (l.morning) score += period * 0.8;
        // Keep a second period of the same subject next to the first (a double) rather than scattered.
        if (today > 0) {
          const adj = [period - 1, period + 1].some((q) => {
            const id = classBusy.get(key(l.classId, day, q));
            return id && placed.get(id)?.lessonId === l.id;
          });
          score += adj ? -3 : 2;
        }
        score += random() * 2;
        if (!best || score < best.score) best = { day, period, venue: venue ?? null, score };
      }
    }
    return best;
  };

  /** Moves a placed lesson to another open slot (freeing its current one). */
  const relocate = (id: string, avoidDay: number, avoidPeriod: number) => {
    const p = placed.get(id)!;
    const l = byId.get(p.lessonId)!;
    remove(id);
    for (const extra of [0, 1]) {
      const s = bestSlot(l, extra);
      if (s && !(s.day === avoidDay && s.period === avoidPeriod)) {
        put(l, s.day, s.period, s.venue);
        return true;
      }
    }
    put(l, p.day, p.period, p.venue);
    return false;
  };

  /** Frees a slot for the lesson by moving the lessons in its way. */
  const repair = (l: LessonRequirement) => {
    const order = [...days].sort(() => random() - 0.5);
    for (const day of order) {
      if ((perDay.get(`${l.id}|${day}`) ?? 0) >= cap(l, 1)) continue;
      for (let period = 0; period < periodsPerDay; period++) {
        if (l.teacherId && blocked.has(key(l.teacherId, day, period))) continue;
        const blockers = [
          classBusy.get(key(l.classId, day, period)),
          l.teacherId ? teacherBusy.get(key(l.teacherId, day, period)) : undefined,
        ].filter((x): x is string => !!x);
        const unique = [...new Set(blockers)];
        if (unique.some((b) => placed.get(b)?.lessonId === l.id)) continue;
        // Move whatever is in the way (the class's lesson there and/or the teacher's other class).
        const moved: string[] = [];
        let ok = true;
        for (const id of unique) {
          if (!placed.has(id)) continue;
          if (relocate(id, day, period)) moved.push(id);
          else { ok = false; break; }
        }
        if (!ok) continue;
        if (classBusy.has(key(l.classId, day, period)) || !teacherFree(l, day, period)) continue;
        let venue = freeVenue(l, day, period);
        if (venue === undefined && l.venues?.length) {
          // Move whoever is using a suitable room.
          const inRoom = l.venues.map((v) => venueBusy.get(key(v, day, period))).find((b) => b && relocate(b, day, period));
          if (!inRoom) continue;
          venue = freeVenue(l, day, period);
          if (venue === undefined) continue;
        }
        put(l, day, period, venue ?? null);
        return true;
      }
    }
    return false;
  };

  // Hardest first: busiest teachers, specialist rooms, then the most periods.
  const teacherLoad = new Map<string, number>();
  for (const l of input.lessons) if (l.teacherId) teacherLoad.set(l.teacherId, (teacherLoad.get(l.teacherId) ?? 0) + l.periodsPerWeek);
  const units: LessonRequirement[] = [];
  for (const l of input.lessons) for (let i = 0; i < l.periodsPerWeek; i++) units.push(l);
  const weight = (l: LessonRequirement) =>
    (l.teacherId ? teacherLoad.get(l.teacherId) ?? 0 : 0) + (l.venues?.length ? 40 / l.venues.length : 0) + l.periodsPerWeek + random() * 6;
  const w = new Map(input.lessons.map((l) => [l.id, weight(l)]));
  units.sort((a, b) => w.get(b.id)! - w.get(a.id)!);

  const missing = new Map<string, number>();
  for (const l of units) {
    const s = bestSlot(l, 0) ?? bestSlot(l, 1);
    if (s) put(l, s.day, s.period, s.venue);
    else if (!repair(l)) missing.set(l.id, (missing.get(l.id) ?? 0) + 1);
  }
  /**
   * For a full class: swap two of the class's own lessons so the teacher of the
   * missing lesson becomes free where the class has its one open period.
   */
  const swapIn = (l: LessonRequirement) => {
    for (const day of days) {
      for (let period = 0; period < periodsPerDay; period++) {
        if (classBusy.has(key(l.classId, day, period))) continue;
        // (day, period) is the class's open period; the teacher of l is busy or blocked there.
        for (const d2 of days) {
          if ((perDay.get(`${l.id}|${d2}`) ?? 0) >= cap(l, 1)) continue;
          for (let p2 = 0; p2 < periodsPerDay; p2++) {
            const xId = classBusy.get(key(l.classId, d2, p2));
            if (!xId || !teacherFree(l, d2, p2)) continue;
            const x = placed.get(xId)!;
            const xl = byId.get(x.lessonId)!;
            if (x.lessonId === l.id) continue;
            // x moves to the open period if its teacher and a room are free there.
            remove(xId);
            const xVenue = freeVenue(xl, day, period);
            const lVenue = freeVenue(l, d2, p2);
            if (teacherFree(xl, day, period) && xVenue !== undefined && lVenue !== undefined && teacherFree(l, d2, p2)) {
              put(xl, day, period, xVenue ?? null);
              put(l, d2, p2, lVenue ?? null);
              return true;
            }
            put(xl, x.day, x.period, x.venue);
          }
        }
      }
    }
    return false;
  };

  // A second repair sweep often finds room once everything else has settled.
  for (const [id, n] of [...missing]) {
    const l = byId.get(id)!;
    let left = n;
    for (let i = 0; i < n; i++) if (repair(l) || swapIn(l)) left--;
    if (left) missing.set(id, left); else missing.delete(id);
  }

  return {
    placements: [...placed.values()],
    unplaced: [...missing].map(([id, n]) => {
      const l = byId.get(id)!;
      return { lessonId: id, classId: l.classId, subjectId: l.subjectId, teacherId: l.teacherId, missing: n };
    }),
  };
}

/** Builds the timetable, trying several orderings and keeping the best. */
export function solveTimetable(input: SolverInput): SolverResult {
  const lessons = input.lessons.filter((l) => l.periodsPerWeek > 0);
  const clean = { ...input, lessons };
  const problems = checkFeasibility(clean);
  const attempts = input.attempts ?? 30;
  let best: ReturnType<typeof solveOnce> | null = null;
  let tried = 0;
  for (let a = 0; a < attempts; a++) {
    tried++;
    const out = solveOnce(clean, rng((input.seed ?? 20260930) + a * 7919));
    const miss = out.unplaced.reduce((s, u) => s + u.missing, 0);
    const bestMiss = best ? best.unplaced.reduce((s, u) => s + u.missing, 0) : Infinity;
    if (miss < bestMiss) best = out;
    if (miss === 0) break;
  }
  return { ...(best ?? { placements: [], unplaced: [] }), problems, attempts: tried };
}

/** Independent check of a finished timetable. An empty list means no clashes. */
export function findClashes(input: SolverInput, placements: Placement[]): Clash[] {
  const clashes: Clash[] = [];
  const seen = new Map<string, Placement>();
  const check = (kind: Clash["kind"], who: string | null, p: Placement, label: string) => {
    if (!who) return;
    const k = key(`${kind}:${who}`, p.day, p.period);
    const other = seen.get(k);
    if (other) clashes.push({ kind, day: p.day, period: p.period, message: `${label} is booked twice on day ${p.day}, period ${p.period + 1}` });
    else seen.set(k, p);
  };
  const blocked = new Set<string>();
  for (const [t, keys] of Object.entries(input.teacherUnavailable ?? {})) {
    for (const k of keys) {
      const [d, p] = k.split("-");
      if (p === "*") for (let i = 0; i < input.periodsPerDay; i++) blocked.add(key(t, Number(d), i));
      else blocked.add(key(t, Number(d), Number(p)));
    }
  }
  for (const p of placements) {
    check("class", p.classId, p, `Class ${p.classId}`);
    check("teacher", p.teacherId, p, `Teacher ${p.teacherId}`);
    check("venue", p.venue, p, `Room ${p.venue}`);
    if (p.teacherId && blocked.has(key(p.teacherId, p.day, p.period))) {
      clashes.push({ kind: "unavailable", day: p.day, period: p.period, message: `Teacher ${p.teacherId} is timetabled when unavailable` });
    }
  }
  const count = new Map<string, number>();
  for (const p of placements) count.set(p.lessonId, (count.get(p.lessonId) ?? 0) + 1);
  for (const l of input.lessons) {
    const n = count.get(l.id) ?? 0;
    if (n > l.periodsPerWeek) clashes.push({ kind: "count", message: `${l.id} has ${n} periods, more than the ${l.periodsPerWeek} required` });
  }
  return clashes;
}
