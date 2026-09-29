import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PORTAL_HOME } from "@/lib/portalHome";
import { DEMO_SUPPORT_STAFF, demoHeadsOfDepartment } from "@/lib/demoStaff";
import { generateDemoSeed } from "@/lib/demoSeeder";

describe("staff roles", () => {
  it("sends every demo staff member to a portal", () => {
    for (const m of DEMO_SUPPORT_STAFF) expect(PORTAL_HOME[m.role], m.position).toMatch(/^\/portal\//);
    expect(PORTAL_HOME.hod).toBe("/portal/hod");
  });

  it("has unique demo staff logins", () => {
    const emails = DEMO_SUPPORT_STAFF.map((m) => m.email);
    expect(new Set(emails).size).toBe(emails.length);
  });

  it("chooses one teaching head for each department", () => {
    const seed = generateDemoSeed();
    const heads = demoHeadsOfDepartment(seed.teachers, seed.subjects);
    const departments = [...heads.values()];
    expect(new Set(departments).size).toBe(departments.length);
    expect(departments).toEqual(expect.arrayContaining(["Mathematics", "Sciences", "Languages", "Humanities", "Commercials"]));
  });

  it("lets the account service create every demo staff role", () => {
    const fn = readFileSync("supabase/functions/seed-demo-accounts/index.ts", "utf8");
    const staffRoles = fn.match(/const STAFF_ROLES = \[([\s\S]*?)\]/)![1];
    for (const role of new Set([...DEMO_SUPPORT_STAFF.map((m) => m.role), "hod", "teacher"])) {
      expect(staffRoles).toContain(`"${role}"`);
    }
  });

  it("adds the new support roles to the database", () => {
    const migration = readFileSync("supabase/migrations/20260929090000_66e26d16-3053-4478-8fd4-64e19a01908d.sql", "utf8");
    for (const role of ["boarding", "nurse", "librarian", "storekeeper"]) {
      expect(migration).toContain(`ADD VALUE IF NOT EXISTS '${role}'`);
    }
  });
});
