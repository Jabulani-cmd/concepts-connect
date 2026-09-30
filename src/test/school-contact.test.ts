import { describe, it, expect } from "vitest";
import { SCHOOL_ADDRESS, SCHOOL_CONTACT_LINE, SCHOOL_EMAIL, SCHOOL_PHONE } from "@/lib/school";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { buildSubscriptionReceiptHtml } from "@/lib/receiptPdf";
import { printableTimetableHtml } from "@/lib/timetableUtils";
import { buildInvoiceHtml, buildReceiptHtml, buildStatementHtml } from "@/lib/finance/pdf";

describe("school contact details", () => {
  it("are the school's address, phone and email", () => {
    expect(SCHOOL_ADDRESS).toBe("2456 Gaydon Crescent, Glen Lorne, Harare, Zimbabwe");
    expect(SCHOOL_PHONE).toBe("+263 77 478 4185");
    expect(SCHOOL_EMAIL).toBe("info@concepts-academy.co.zw");
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
      buildInvoiceHtml({
        invoiceNumber: "INV1", academicYear: "2026", term: "Term 1",
        student: { fullName: "S", admissionNumber: "A1" }, items: [{ description: "Tuition", amount_usd: 100, amount_zig: 0 }],
        totals: { total_usd: 100, total_zig: 0, paid_usd: 0, paid_zig: 0 },
      }),
      buildReceiptHtml({
        receiptNumber: "R2", paymentDate: "2026-01-01", student: { fullName: "S", admissionNumber: "A1" },
        amounts: { usd: 100 }, paymentMethod: "Cash",
      }),
      buildStatementHtml({ student: { fullName: "S", admissionNumber: "A1" }, invoices: [], payments: [] }),
    ];
    for (const html of docs) {
      expect(html).toContain(SCHOOL_ADDRESS);
      expect(html).toContain(SCHOOL_PHONE);
      expect(html).toContain(SCHOOL_EMAIL);
    }
  });
});
