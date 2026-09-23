import { describe, it, expect } from "vitest";
import { FORM_LEVELS, DEFAULT_FORM, formLabel } from "@/lib/forms";
import { generateDemoSeed } from "@/lib/demoSeeder";
import { zimPhoneRegex } from "@/lib/validators";

describe("Zimbabwean form levels", () => {
  it("covers Form 1 to Form 6", () => {
    expect(FORM_LEVELS).toEqual(["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6"]);
    expect(DEFAULT_FORM).toBe("Form 1");
  });

  it("names the sixth-form years", () => {
    expect(formLabel("Form 5")).toBe("Form 5 (Lower Sixth)");
    expect(formLabel("Form 6")).toBe("Form 6 (Upper Sixth)");
    expect(formLabel("Form 2")).toBe("Form 2");
  });
});

describe("Demo seed", () => {
  const seed = generateDemoSeed();

  it("builds classes for every form", () => {
    const levels = new Set(seed.classes.map((c) => `Form ${c.formLevel}`));
    expect([...levels].sort()).toEqual([...FORM_LEVELS]);
    expect(seed.classes.every((c) => /^Form [1-6][AB]$/.test(c.name))).toBe(true);
  });

  it("gives A-Level classes only A-Level subjects", () => {
    const names = (formLevel: number) => {
      const cls = seed.classes.find((c) => c.formLevel === formLevel)!;
      return cls.subjects.map((s) => seed.subjects.find((sub) => sub.id === s.subjectId)!.name);
    };
    expect(names(6)).toContain("Pure Mathematics");
    expect(names(6)).not.toContain("Combined Science");
    expect(names(1)).toContain("Combined Science");
  });

  it("uses valid Zimbabwean phone numbers for parents", () => {
    expect(seed.parents.length).toBe(seed.students.length * 2);
    expect(seed.parents.every((p) => zimPhoneRegex.test(p.phone))).toBe(true);
  });
});
