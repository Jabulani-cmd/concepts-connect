import { describe, it, expect, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

import { withStaffPrivate, STAFF_COLUMNS } from "@/lib/staff";

describe("staff private fields", () => {
  it("never selects the protected columns directly", () => {
    for (const col of ["national_id", "nssa_number", "paye_number", "bank_details", "address", "emergency_contact"]) {
      expect(STAFF_COLUMNS.split(/,\s*/)).not.toContain(col);
    }
  });

  it("merges what the server allows and blanks the rest", async () => {
    rpc.mockResolvedValue({ data: [{ id: "a", national_id: "63-123456-A-00", nssa_number: null, paye_number: null, bank_details: "CBZ", address: null, emergency_contact: null }], error: null });
    const rows = await withStaffPrivate([{ id: "a", full_name: "Mr A" }, { id: "b", full_name: "Mrs B" }]);
    expect(rpc).toHaveBeenCalledWith("get_staff_private", { _staff_ids: ["a", "b"] });
    expect(rows[0]).toMatchObject({ full_name: "Mr A", national_id: "63-123456-A-00", bank_details: "CBZ" });
    expect(rows[1]).toMatchObject({ full_name: "Mrs B", national_id: null, bank_details: null });
  });
});
