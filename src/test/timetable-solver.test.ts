import { describe, it, expect } from "vitest";
import { generateDemoSeed } from "@/lib/demoSeeder";
import { findClashes, solveTimetable, type SolverInput } from "@/lib/timetable/solver";

/** The demo school (30 classes, real subject allocations and specialist rooms) as solver input. */
function demoInput(): SolverInput {
  const seed = generateDemoSeed();
  const specialist = (type: string) => seed.rooms.filter((r) => r.type === type).map((r) => r.name);
  return {
    days: [1, 2, 3, 4, 5],
    periodsPerDay: 8,
    lessons: seed.allocations.map((a) => {
      const sub = seed.subjects.find((s) => s.id === a.subjectId)!;
      const type = sub.allowedRoomTypes[0];
      return {
        id: a.id,
        classId: a.classId,
        subjectId: a.subjectId,
        teacherId: a.teacherId,
        periodsPerWeek: a.periodsPerWeek,
        venues: type === "Regular" ? [] : specialist(type),
        morning: /math|english/i.test(sub.name),
      };
    }),
  };
}

describe("whole-school timetable solver", () => {
  it("places every lesson of the demo school with no clashes", () => {
    const input = demoInput();
    const out = solveTimetable(input);
    expect(out.problems).toEqual([]);
    expect(out.unplaced).toEqual([]);
    const needed = input.lessons.reduce((s, l) => s + l.periodsPerWeek, 0);
    expect(out.placements).toHaveLength(needed);
    expect(findClashes(input, out.placements)).toEqual([]);
  });

  it("spreads a subject across the week", () => {
    const input = demoInput();
    const out = solveTimetable(input);
    const perDay = new Map<string, number>();
    for (const p of out.placements) perDay.set(`${p.lessonId}|${p.day}`, (perDay.get(`${p.lessonId}|${p.day}`) ?? 0) + 1);
    expect(Math.max(...perDay.values())).toBeLessThanOrEqual(2);
  });

  it("never timetables a teacher on their day off", () => {
    const input = demoInput();
    const teacher = input.lessons[0].teacherId!;
    input.teacherUnavailable = { [teacher]: ["3-*"] };
    const out = solveTimetable(input);
    expect(out.placements.some((p) => p.teacherId === teacher && p.day === 3)).toBe(false);
    expect(findClashes(input, out.placements)).toEqual([]);
  });

  it("fills a completely packed week (every period of every class) with shared labs", () => {
    const perSubject = [6, 5, 5, 4, 4, 4, 4, 3, 3, 2]; // 40 periods: 5 days x 8
    const lessons: SolverInput["lessons"] = [];
    for (let c = 0; c < 24; c++) {
      perSubject.forEach((n, s) => {
        const teachers = Math.ceil((24 * n) / 34);
        lessons.push({
          id: `c${c}s${s}`, classId: `c${c}`, subjectId: `s${s}`, teacherId: `t${s}-${c % teachers}`,
          periodsPerWeek: n, venues: s === 2 ? ["Lab 1", "Lab 2", "Lab 3"] : [], morning: s < 2,
        });
      });
    }
    const input: SolverInput = { days: [1, 2, 3, 4, 5], periodsPerDay: 8, lessons };
    const out = solveTimetable(input);
    expect(out.unplaced).toEqual([]);
    expect(out.placements).toHaveLength(24 * 40);
    expect(findClashes(input, out.placements)).toEqual([]);
  });

  it("explains a timetable that cannot work instead of double-booking", () => {
    const input: SolverInput = {
      days: [1, 2],
      periodsPerDay: 2,
      lessons: [
        { id: "a", classId: "c1", subjectId: "s1", teacherId: "t1", periodsPerWeek: 3 },
        { id: "b", classId: "c2", subjectId: "s1", teacherId: "t1", periodsPerWeek: 3 },
      ],
    };
    const out = solveTimetable(input);
    expect(out.problems.map((p) => p.kind)).toContain("teacher_overloaded");
    expect(out.unplaced.reduce((s, u) => s + u.missing, 0)).toBe(2);
    expect(findClashes(input, out.placements)).toEqual([]);
  });

  it("the clash check catches a double-booked teacher", () => {
    const input: SolverInput = { days: [1], periodsPerDay: 1, lessons: [] };
    const clashes = findClashes(input, [
      { lessonId: "a", classId: "c1", subjectId: "s", teacherId: "t1", day: 1, period: 0, venue: null },
      { lessonId: "b", classId: "c2", subjectId: "s", teacherId: "t1", day: 1, period: 0, venue: null },
    ]);
    expect(clashes.map((c) => c.kind)).toEqual(["teacher"]);
  });
});
