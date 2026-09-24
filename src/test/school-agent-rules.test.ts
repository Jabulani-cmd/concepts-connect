import { describe, it, expect } from "vitest";
import { scoreLearner, ruleExplanation } from "../../supabase/functions/school-agent/rules";

const base = { attendance_before: 95, attendance_recent: 93, subjects: [], assignments_due: 3, assignments_missed: 0 };

describe("school agent: at-risk rules", () => {
  it("does not flag a learner who is doing fine", () => {
    expect(scoreLearner(base)).toMatchObject({ points: 0, severity: null });
  });

  it("gives 2 points for attendance falling more than 20 points", () => {
    const r = scoreLearner({ ...base, attendance_recent: 70 });
    expect(r.points).toBe(2);
    expect(r.severity).toBe("medium");
    expect(r.reasons[0]).toContain("95% to 70%");
  });

  it("needs marks to fall more than 10 points in at least two subjects", () => {
    const one = scoreLearner({ ...base, subjects: [{ subject: "Mathematics", before: 70, recent: 55 }] });
    expect(one.points).toBe(0);
    const two = scoreLearner({ ...base, subjects: [{ subject: "Mathematics", before: 70, recent: 55 }, { subject: "Physics", before: 66, recent: 50 }, { subject: "History", before: 60, recent: 55 }] });
    expect(two.points).toBe(2);
    expect(two.declining.map((d) => d.subject)).toEqual(["Mathematics", "Physics"]);
  });

  it("gives 1 point for missing more than 30% of homework, not enough on its own to flag", () => {
    const r = scoreLearner({ ...base, assignments_missed: 2 });
    expect(r.points).toBe(1);
    expect(r.severity).toBe("low");
  });

  it("marks all three signals together as high priority, with practical next steps", () => {
    const r = scoreLearner({
      attendance_before: 96, attendance_recent: 60, assignments_due: 3, assignments_missed: 2,
      subjects: [{ subject: "Biology", before: 72, recent: 50 }, { subject: "Chemistry", before: 68, recent: 49 }],
    });
    expect(r.points).toBe(5);
    expect(r.severity).toBe("high");
    const ex = ruleExplanation(r);
    expect(ex.actions).toHaveLength(3);
    expect(ex.explanation).toMatch(/Attendance fell/);
  });

  it("ignores attendance when there are not enough records", () => {
    expect(scoreLearner({ ...base, attendance_before: null, attendance_recent: null }).points).toBe(0);
  });
});
