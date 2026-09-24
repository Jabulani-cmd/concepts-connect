import { describe, it, expect } from "vitest";
import { ilikeAny } from "@/lib/search";
import { emptyToNull } from "@/lib/utils";
import { errorMessage } from "@/lib/errors";
import { paymentMethodLabel, OFFICE_PAYMENT_METHODS } from "@/lib/finance/paymentMethods";
import { parseQuestions, parseQuizResult } from "@/lib/assessments";

describe("ilikeAny", () => {
  it("matches the term against every column", () => {
    expect(ilikeAny(["full_name", "admission_number"], "moyo")).toBe(
      "full_name.ilike.%moyo%,admission_number.ilike.%moyo%",
    );
  });

  it("strips characters that would break the filter", () => {
    expect(ilikeAny(["full_name"], "a,b(c)*%")).toBe("full_name.ilike.%a b c%");
  });
});

describe("emptyToNull", () => {
  it("replaces empty strings only", () => {
    expect(emptyToNull({ a: "", b: "x", c: 0, d: false })).toEqual({ a: null, b: "x", c: 0, d: false });
  });
});

describe("errorMessage", () => {
  it("reads Error, string and PostgREST-style errors", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage({ message: "db error", code: "42P01" })).toBe("db error");
  });

  it("falls back for unknown values", () => {
    expect(errorMessage(undefined)).toBe("Something went wrong");
    expect(errorMessage(42, "Custom")).toBe("Custom");
  });
});

describe("payment methods", () => {
  it("labels Zimbabwean methods", () => {
    expect(paymentMethodLabel("ecocash")).toBe("EcoCash");
    expect(paymentMethodLabel("bank_transfer")).toBe("Bank Transfer (RTGS)");
    expect(paymentMethodLabel("eft")).toBe("Internet Banking (ZIPIT)");
  });

  it("offers cash at the bursar's office but not legacy South African methods", () => {
    expect(OFFICE_PAYMENT_METHODS).toContain("cash");
    expect(OFFICE_PAYMENT_METHODS).not.toContain("snapscan");
    expect(OFFICE_PAYMENT_METHODS).not.toContain("zapper");
  });

  it("shows unknown values unchanged and blanks as a dash", () => {
    expect(paymentMethodLabel("cheque")).toBe("cheque");
    expect(paymentMethodLabel(null)).toBe("-");
  });
});

describe("parseQuestions", () => {
  it("keeps well-formed questions and drops the rest", () => {
    const q = { id: "q1", question: "2+2?", options: ["3", "4"], correct_index: 1 };
    expect(parseQuestions([q, { id: 5 }, null, "x"])).toEqual([q]);
  });

  it("returns an empty list for non-arrays", () => {
    expect(parseQuestions(null)).toEqual([]);
    expect(parseQuestions({ id: "q1" })).toEqual([]);
  });
});

describe("parseQuizResult", () => {
  it("reads the marking returned by submit_quiz", () => {
    expect(parseQuizResult({ mark: 3, total: 4, percentage: 75, grade: "A", passed: true }))
      .toEqual({ mark: 3, total: 4, percentage: 75, grade: "A", passed: true });
  });

  it("ignores anything that is not a marking result", () => {
    expect(parseQuizResult(null)).toBeNull();
    expect(parseQuizResult([1])).toBeNull();
    expect(parseQuizResult({ mark: 1 })).toBeNull();
  });
});
