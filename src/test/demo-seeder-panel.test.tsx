import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Loads the demo school through the admin panel against a fake Supabase client
 * and checks what would reach the database and the account edge function.
 */

type Row = Record<string, unknown>;
const writes: { table: string; op: string; rows: Row[] }[] = [];
const invokes: { accounts: Row[] }[] = [];

function fakeQuery(table: string) {
  let result: { data: unknown; error: null } = { data: [], error: null };
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const m of ["select", "eq", "in", "like", "ilike", "order", "limit"]) chain[m] = vi.fn(self);
  const write = (op: string) => (rows: Row | Row[]) => {
    const list = Array.isArray(rows) ? rows : [rows];
    writes.push({ table, op, rows: list });
    result = { data: list.map((r, i) => ({ id: `${table}-${writes.length}-${i}`, ...r })), error: null };
    return chain;
  };
  chain.insert = vi.fn(write("insert"));
  chain.upsert = vi.fn(write("upsert"));
  chain.update = vi.fn(write("update"));
  chain.delete = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: (result.data as Row[])[0] ?? null, error: null }));
  chain.then = (resolve: (r: typeof result) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fakeQuery(table),
    functions: {
      invoke: vi.fn(async (_name: string, { body }: { body: { accounts: Row[] } }) => {
        invokes.push(body);
        return { data: { ok: true, errors: 0 }, error: null };
      }),
    },
  },
}));

import DemoDataSeederPanel from "@/components/admin/DemoDataSeederPanel";
import { AllocationProvider } from "@/contexts/AllocationContext";
import { DemoPeopleProvider } from "@/contexts/DemoPeopleContext";

describe("Demo data seeder panel", () => {
  it("saves 500 students and creates a linked login for everyone", async () => {
    render(
      <AllocationProvider>
        <DemoPeopleProvider>
          <DemoDataSeederPanel />
        </DemoPeopleProvider>
      </AllocationProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /load demo data/i }));
    await waitFor(() => expect(screen.getByText(/demo data loaded successfully/i)).toBeInTheDocument(), { timeout: 15000 });

    // Classes are written before students, so the roster trigger can link each student.
    const firstClass = writes.findIndex((w) => w.table === "classes" && w.op === "insert");
    const firstStudent = writes.findIndex((w) => w.table === "students");
    expect(firstClass).toBeGreaterThanOrEqual(0);
    expect(firstClass).toBeLessThan(firstStudent);

    const students = writes.filter((w) => w.table === "students" && w.op === "upsert").flatMap((w) => w.rows);
    expect(students).toHaveLength(500);
    expect(students.every((s) => /^Form [1-6]$/.test(String(s.form)) && s.class === `${s.form}${s.stream}`)).toBe(true);
    expect(students.every((s) => s.guardian_name && s.guardian_phone && s.province)).toBe(true);

    // Logins: 1 admin + 30 teachers + 500 students + 429 parents, in small batches.
    const accounts = invokes.flatMap((b) => b.accounts);
    expect(invokes.every((b) => b.accounts.length <= 40)).toBe(true);
    expect(new Set(accounts.map((a) => a.email)).size).toBe(accounts.length);
    const count = (role: string) => accounts.filter((a) => a.role === role).length;
    expect([count("admin"), count("teacher"), count("student"), count("parent")]).toEqual([1, 30, 500, 429]);
    expect(accounts.filter((a) => a.role === "student").every((a) => a.admission_number)).toBe(true);

    // Parents are sent after every student, and each child is linked exactly once.
    const lastStudentCall = Math.max(...invokes.map((b, i) => (b.accounts.some((a) => a.role === "student") ? i : -1)));
    const firstParentCall = invokes.findIndex((b) => b.accounts.some((a) => a.role === "parent"));
    expect(firstParentCall).toBeGreaterThan(lastStudentCall);
    const linked = accounts.flatMap((a) => (a.children as { admission_number: string }[] | undefined) ?? []).map((c) => c.admission_number);
    expect(new Set(linked).size).toBe(500);
    expect(linked).toHaveLength(500);
  }, 30000);
});
