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
  const all = [...seed.teachers, ...seed.students, ...seed.parents];

  it("enrols 500 students across Forms 1 to 6", () => {
    expect(seed.students).toHaveLength(500);
    const perForm = [1, 2, 3, 4, 5, 6].map((f) => seed.students.filter((s) => s.form === f).length);
    expect(perForm).toEqual([105, 105, 105, 105, 40, 40]);
    expect(seed.classes.every((c) => /^Form [1-6][ABC]$/.test(c.name))).toBe(true);
    for (const c of seed.classes) {
      expect(seed.students.filter((s) => s.classId === c.id)).toHaveLength(c.studentCount);
    }
  });

  it("gives every student exactly one parent login, shared between siblings", () => {
    const parentsOf = (id: string) => seed.parents.filter((p) => p.childIds.includes(id));
    expect(seed.students.every((s) => parentsOf(s.id).length === 1)).toBe(true);
    const siblings = seed.parents.filter((p) => p.childIds.length > 1);
    expect(siblings.length).toBeGreaterThan(0);
    for (const p of siblings) {
      const kids = p.childIds.map((id) => seed.students.find((s) => s.id === id)!);
      expect(new Set(kids.map((k) => k.fullName.split(" ").pop()))).toEqual(new Set([p.fullName.split(" ").pop()]));
      expect(new Set(kids.map((k) => k.classId)).size).toBe(kids.length);
    }
  });

  it("uses unique demo-domain logins and Zimbabwean phone numbers", () => {
    const emails = all.map((p) => p.email);
    expect(new Set(emails).size).toBe(emails.length);
    expect(emails.every((e) => e.endsWith("schooldemo.com"))).toBe(true);
    expect(seed.parents.every((p) => zimPhoneRegex.test(p.phone))).toBe(true);
  });

  it("gives A-Level classes only their stream's subjects", () => {
    const names = (className: string) => {
      const cls = seed.classes.find((c) => c.name === className)!;
      return cls.subjects.map((s) => seed.subjects.find((sub) => sub.id === s.subjectId)!.name);
    };
    expect(names("Form 6A")).toEqual(expect.arrayContaining(["Pure Mathematics", "Physics", "Chemistry", "Biology"]));
    expect(names("Form 6B")).toEqual(expect.arrayContaining(["Accounting", "Business Studies", "Economics"]));
    expect(names("Form 6A")).not.toContain("Accounting");
    expect(names("Form 1A")).toContain("Combined Science");
  });

  it("builds a clash-free timetable with every lesson placed", () => {
    const seen = new Set<string>();
    for (const s of seed.slots) {
      for (const key of [`t${s.day}-${s.period}-${s.teacherId}`, `r${s.day}-${s.period}-${s.roomId}`]) {
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    for (const a of seed.allocations) {
      const placed = seed.slots.filter((s) => s.classId === a.classId && s.subjectId === a.subjectId).length;
      expect(placed).toBe(a.periodsPerWeek);
    }
  });
});
