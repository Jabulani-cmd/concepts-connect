import { describe, it, expect } from "vitest";
import { gradeFor, gradeBadgeClass, gradeLabel, GRADE_BANDS, PASS_MARK } from "@/lib/grading";

describe("ZIMSEC grading", () => {
  it.each([
    [100, "A"], [75, "A"],
    [74, "B"], [65, "B"],
    [64, "C"], [50, "C"],
    [49, "D"], [45, "D"],
    [44, "E"], [40, "E"],
    [39, "U"], [0, "U"],
  ])("%i%% is grade %s", (percent, grade) => {
    expect(gradeFor(percent)).toBe(grade);
  });

  it("treats missing marks as ungraded", () => {
    expect(gradeFor(null)).toBe("U");
    expect(gradeFor(undefined)).toBe("U");
  });

  it("passes at grade C", () => {
    expect(gradeFor(PASS_MARK)).toBe("C");
    expect(gradeFor(PASS_MARK - 1)).not.toBe("C");
  });

  it("orders bands from highest to lowest", () => {
    const mins = GRADE_BANDS.map((b) => b.min);
    expect([...mins].sort((a, b) => b - a)).toEqual(mins);
  });

  it("labels and styles every grade", () => {
    for (const { grade } of GRADE_BANDS) {
      expect(gradeLabel(grade)).not.toBe("");
      expect(gradeBadgeClass(grade)).toMatch(/^bg-/);
    }
    expect(gradeBadgeClass("X")).toBe("bg-muted text-muted-foreground");
  });
});
