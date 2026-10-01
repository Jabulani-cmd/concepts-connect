import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { demoFeeStatus, demoSubscriptionPaid } from "@/lib/demoAccounts";

describe("demo billing", () => {
  it("leaves one family in four unpaid so the payment journey can be shown", () => {
    const numbers = Array.from({ length: 500 }, (_, i) => `CLA${90001 + i}`);
    const unpaid = numbers.filter((n) => !demoSubscriptionPaid(n)).length;
    expect(unpaid).toBe(125);
    const fees = numbers.map(demoFeeStatus);
    expect(fees.filter((f) => f === "Paid").length).toBe(225);
    expect(fees.filter((f) => f === "Part-paid").length).toBe(150);
    expect(fees.filter((f) => f === "Unpaid").length).toBe(125);
  });

  it("matches the database's demo billing rules", () => {
    const sql = readFileSync("supabase/migrations/20260930170100_4a8c2f61-7b39-4e5d-a1c6-3d9e7f2b5a84.sql", "utf8");
    expect(sql).toContain("v_n % 4 = 3");
    expect(sql).toContain("v_n % 20 < 9");
    expect(sql).toContain("v_n % 20 < 15");
  });
});
