import { describe, it, expect, vi, beforeEach } from "vitest";

type Call = { op: string; table: string; payload?: unknown; filters: [string, string, unknown][] };
const calls: Call[] = [];
let existingRows: { id: string; student_id: string }[] = [];

function builder(table: string) {
  const call: Call = { op: "select", table, filters: [] };
  const chain = {
    select: () => { call.op = "select"; return chain; },
    insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; calls.push(call); return Promise.resolve({ error: null }); },
    update: (payload: unknown) => { call.op = "update"; call.payload = payload; return chain; },
    eq: (col: string, val: unknown) => { call.filters.push(["eq", col, val]); return chain; },
    in: (col: string, val: unknown) => { call.filters.push(["in", col, val]); return chain; },
    then: (resolve: (r: unknown) => void) => {
      calls.push(call);
      return Promise.resolve(call.op === "select" ? { data: existingRows, error: null } : { error: null }).then(resolve);
    },
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (t: string) => builder(t) } }));

import { saveClassAttendance } from "@/lib/attendance";

describe("saveClassAttendance", () => {
  beforeEach(() => {
    calls.length = 0;
    existingRows = [];
  });

  it("inserts a full register when none exists", async () => {
    await saveClassAttendance("class-1", "2026-09-23", { s1: "present", s2: "absent" }, "teacher-1");
    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.payload).toEqual([
      { student_id: "s1", class_id: "class-1", date: "2026-09-23", status: "present", recorded_by: "teacher-1" },
      { student_id: "s2", class_id: "class-1", date: "2026-09-23", status: "absent", recorded_by: "teacher-1" },
    ]);
    expect(calls.some((c) => c.op === "update")).toBe(false);
  });

  it("updates existing rows grouped by status and inserts only new students", async () => {
    existingRows = [{ id: "a1", student_id: "s1" }, { id: "a2", student_id: "s2" }];
    await saveClassAttendance("class-1", "2026-09-23", { s1: "late", s2: "late", s3: "present" }, null);

    const updates = calls.filter((c) => c.op === "update");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({ status: "late", recorded_by: null });
    expect(updates[0].filters).toContainEqual(["in", "id", ["a1", "a2"]]);

    const insert = calls.find((c) => c.op === "insert");
    expect(insert?.payload).toEqual([
      { student_id: "s3", class_id: "class-1", date: "2026-09-23", status: "present", recorded_by: null },
    ]);
  });
});
