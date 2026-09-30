import { describe, it, expect } from "vitest";
import { planCover, rankCover, type CoverContext, type CoverLesson } from "@/lib/timetable/cover";

const lesson = (key: string, teacherId: string, start: string, end: string, extra: Partial<CoverLesson> = {}): CoverLesson => ({
  key, classId: "c1", className: "Form 1A", subjectId: "maths", subjectName: "Mathematics", teacherId, start, end, room: null, ...extra,
});

function ctx(dayLessons: CoverLesson[], away: string[]): CoverContext {
  return {
    staff: [
      { id: "absent", name: "Mr Absent", department: "Mathematics", subjectsTaught: [] },
      { id: "maths2", name: "Mrs Maths", department: "Mathematics", subjectsTaught: [] },
      { id: "busy", name: "Mr Busy", department: "Mathematics", subjectsTaught: [] },
      { id: "english", name: "Ms English", department: "Languages", subjectsTaught: [] },
      { id: "sick", name: "Mr Sick", department: "Mathematics", subjectsTaught: [] },
    ],
    dayLessons,
    away: new Set(away),
    teachesSubject: new Map([["maths2", new Set(["maths"])], ["busy", new Set(["maths"])], ["sick", new Set(["maths"])]]),
    teachesClass: new Map(),
    subjectDepartment: new Map([["maths", "Mathematics"]]),
    assigned: [],
    weekCover: new Map(),
  };
}

describe("cover suggestions", () => {
  const p1 = lesson("p1", "absent", "07:30", "08:15");
  const p2 = lesson("p2", "absent", "08:15", "09:00", { classId: "c2", className: "Form 2B" });
  const busyAtP1 = lesson("b1", "busy", "07:30", "08:15", { classId: "c3", className: "Form 3A" });

  it("only suggests teachers who are free and not away, subject teachers first", () => {
    const ranked = rankCover(p1, ctx([p1, busyAtP1], ["absent", "sick"]));
    expect(ranked.map((c) => c.staffId)).toEqual(["maths2", "english"]);
    expect(ranked[0].reasons).toContain("teaches Mathematics");
  });

  it("never gives one teacher two lessons at the same time, and shares cover out", () => {
    const other = lesson("p1b", "absent", "07:30", "08:15", { classId: "c4", className: "Form 4A", subjectName: "Mathematics" });
    const plan = planCover([p1, other, p2], ctx([p1, other, p2, busyAtP1], ["absent", "sick"]));
    const at730 = plan.filter((i) => i.lesson.start === "07:30").map((i) => i.suggestion?.staffId);
    expect(new Set(at730).size).toBe(2);
    expect(plan.every((i) => i.suggestion)).toBe(true);
  });

  it("says when no one is free", () => {
    const c = ctx([p1], ["absent", "sick"]);
    c.staff = c.staff.filter((s) => s.id === "absent");
    expect(planCover([p1], c)[0].suggestion).toBeNull();
  });
});
