import { describe, it, expect } from "vitest";
import {
  DEFAULT_ALERT_SETTINGS as S, alertKey, classify, parentAbsent, parentExcellent, parentSupport, ruleSummary, studentSupport,
  type DailyReport, type Performance,
} from "../../supabase/functions/school-agent/alerts";

const learner = (over: Partial<Performance> = {}): Performance => ({
  student_id: "s1", full_name: "Tendai Moyo", class_id: "c1", class_name: "Form 2B",
  recent_avg: 60, marks_count: 6, attendance_pct: 95, days_absent: 0, absent_today: false,
  subjects: [{ subject: "Maths", avg: 55, n: 2 }, { subject: "English", avg: 60, n: 2 }, { subject: "Science", avg: 65, n: 2 }],
  ...over,
});

describe("school agent: family alerts", () => {
  it("leaves an average learner alone", () => {
    expect(classify(learner(), S)).toMatchObject({ low: false, excellent: false });
  });

  it("flags a learner below the support mark, or weak in two subjects", () => {
    expect(classify(learner({ recent_avg: 38 }), S).low).toBe(true);
    const twoWeak = learner({ recent_avg: 50, subjects: [{ subject: "Maths", avg: 30, n: 2 }, { subject: "English", avg: 40, n: 2 }, { subject: "Art", avg: 80, n: 2 }] });
    expect(classify(twoWeak, S).low).toBe(true);
  });

  it("does not judge on fewer than three marks", () => {
    expect(classify(learner({ recent_avg: 20, marks_count: 2 }), S).low).toBe(false);
  });

  it("praises consistent excellence only", () => {
    const top = learner({ recent_avg: 82, subjects: [{ subject: "Maths", avg: 90, n: 2 }, { subject: "English", avg: 78, n: 2 }, { subject: "Science", avg: 79, n: 2 }] });
    expect(classify(top, S).excellent).toBe(true);
    expect(parentExcellent(top, S).message).toContain("best: Maths, 90%");
    const uneven = learner({ recent_avg: 80, subjects: [{ subject: "Maths", avg: 99, n: 2 }, { subject: "English", avg: 99, n: 2 }, { subject: "Science", avg: 40, n: 2 }] });
    expect(classify(uneven, S).excellent).toBe(false);
  });

  it("writes factual, first-name messages for parents and learners", () => {
    const low = learner({ recent_avg: 38, subjects: [{ subject: "Maths", avg: 30, n: 2 }, { subject: "English", avg: 42, n: 2 }, { subject: "Art", avg: 42, n: 2 }] });
    expect(parentAbsent(low, "2026-10-01")).toMatchObject({ type: "child_absent", title: "Tendai was absent today" });
    expect(parentAbsent(low, "2026-10-01").message).toContain("Form 2B");
    expect(parentSupport(low, S).message).toContain("Maths (30%)");
    expect(studentSupport(low, S).type).toBe("progress_support");
    for (const m of [parentAbsent(low, "2026-10-01"), parentSupport(low, S), studentSupport(low, S)]) expect(m.message.includes(String.fromCharCode(0x2014))).toBe(false);
  });

  it("sends absence once a day, support every two weeks and praise once a month", () => {
    expect(alertKey("absent", "s1", "2026-10-01")).not.toBe(alertKey("absent", "s1", "2026-10-02"));
    expect(alertKey("support", "s1", "2026-10-01")).toBe(alertKey("support", "s1", "2026-10-03"));
    expect(alertKey("excellent", "s1", "2026-10-01")).toBe(alertKey("excellent", "s1", "2026-10-30"));
  });

  it("summarises the day for the principal", () => {
    const r: DailyReport = {
      date: "2026-10-01", generated_at: "",
      attendance: { registers_taken: 14, classes: 16, present_pct: 93.5, absent_today: 21, absent: [], chronic: [{ name: "A", class_name: "F1", attendance_pct: 70 }] },
      performance: { learners_with_marks: 400, school_avg: 61.2, at_risk: 9, low: [], excellent: [] },
      teachers: { away: [{ name: "Mr X", reason: "sick leave", lessons: 5, covered: 3 }], lessons_needing_cover: 2 },
      fees: { overdue_invoices: 30, learners_owing: 28, total_usd: 4520, top_debtors: [] },
      open_items: {},
    };
    const text = ruleSummary(r);
    expect(text).toContain("14 of 16 classes");
    expect(text).toContain("2 lessons still need cover");
    expect(text).toContain("US$ 4520.00");
  });
});
