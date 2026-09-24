import { describe, it, expect } from "vitest";
import { SCHOOL_ADDRESS, SCHOOL_CONTACT_LINE, SCHOOL_EMAIL, SCHOOL_PHONE } from "@/lib/school";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { buildSubscriptionReceiptHtml } from "@/lib/receiptPdf";
import { printableTimetableHtml } from "@/lib/timetableUtils";

describe("school contact details", () => {
  it("are the school's address, phone and email", () => {
    expect(SCHOOL_ADDRESS).toBe("2456 Gaydon Crescent, Glen Lorne, Harare, Zimbabwe");
    expect(SCHOOL_PHONE).toBe("+263 78 982 4741");
    expect(SCHOOL_EMAIL).toBe("info@mavingtech.com");
    expect(SCHOOL_CONTACT_LINE).toContain(SCHOOL_ADDRESS);
  });

  it("appear on printed documents", () => {
    const docs = [
      buildBrandedHtml({ title: "Report", bodyHtml: "<p>x</p>" }),
      buildSubscriptionReceiptHtml({
        receiptNumber: "R1", parentName: "P", studentName: "S", amount: 10, method: "EcoCash",
        transactionId: "T1", plan: "Term", accessStart: "2026-01-01", accessEnd: "2026-04-01", date: "2026-01-01",
      }),
      printableTimetableHtml("Form 1A", [1], [], []),
    ];
    for (const html of docs) {
      expect(html).toContain(SCHOOL_ADDRESS);
      expect(html).toContain(SCHOOL_PHONE);
      expect(html).toContain(SCHOOL_EMAIL);
    }
  });
});
