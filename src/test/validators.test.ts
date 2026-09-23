import { describe, it, expect } from "vitest";
import {
  zimPhoneRegex,
  zimNationalIdSchema,
  studentFormSchema,
  staffFormSchema,
} from "@/lib/validators";

describe("Zimbabwe Phone Validation", () => {
  it("accepts valid 0 format", () => {
    expect(zimPhoneRegex.test("0771234567")).toBe(true); // Econet
    expect(zimPhoneRegex.test("0712345678")).toBe(true); // NetOne
    expect(zimPhoneRegex.test("0731234567")).toBe(true); // Telecel
    expect(zimPhoneRegex.test("0242123456")).toBe(true); // Harare landline
  });

  it("accepts valid +263 format", () => {
    expect(zimPhoneRegex.test("+263771234567")).toBe(true);
    expect(zimPhoneRegex.test("263771234567")).toBe(true);
  });

  it("rejects invalid numbers", () => {
    expect(zimPhoneRegex.test("1234567890")).toBe(false);
    expect(zimPhoneRegex.test("077123456")).toBe(false);     // mobile too short
    expect(zimPhoneRegex.test("+26377123456")).toBe(false);  // mobile too short
    expect(zimPhoneRegex.test("07712345678")).toBe(false);   // too long
    expect(zimPhoneRegex.test("0521234567")).toBe(false);    // invalid prefix
    expect(zimPhoneRegex.test("")).toBe(false);
  });
});

describe("Zimbabwe National ID Validation", () => {
  it("accepts valid national IDs", () => {
    expect(zimNationalIdSchema.safeParse("63-123456-A-00").success).toBe(true);
    expect(zimNationalIdSchema.safeParse("631234567A00").success).toBe(true);
    expect(zimNationalIdSchema.safeParse("").success).toBe(true);
  });

  it("rejects invalid IDs", () => {
    expect(zimNationalIdSchema.safeParse("1234567890123").success).toBe(false);
    expect(zimNationalIdSchema.safeParse("abc").success).toBe(false);
  });
});

describe("Student Form Schema", () => {
  const validStudent = {
    admission_number: "STU0001",
    full_name: "Tendai Moyo",
    form: "Form 1",
    date_of_birth: "2010-05-15",
    gender: "Male",
    guardian_name: "Mr. Moyo",
    guardian_phone: "0771234567",
    guardian_email: "moyo@example.com",
    emergency_contact: "0712345678",
    address: "123 Samora Machel Ave, Harare",
    enrollment_date: "2026-01-15",
  };

  it("validates a minimal valid student", () => {
    expect(studentFormSchema.safeParse(validStudent).success).toBe(true);
  });

  it("rejects missing full_name", () => {
    expect(studentFormSchema.safeParse({ ...validStudent, full_name: "" }).success).toBe(false);
  });

  it("rejects missing grade", () => {
    expect(studentFormSchema.safeParse({ ...validStudent, form: "" }).success).toBe(false);
  });

  it("rejects invalid guardian phone", () => {
    expect(studentFormSchema.safeParse({ ...validStudent, guardian_phone: "12345" }).success).toBe(false);
  });

  it("rejects invalid guardian email", () => {
    expect(studentFormSchema.safeParse({ ...validStudent, guardian_email: "not-an-email" }).success).toBe(false);
  });
});

describe("Staff Form Schema", () => {
  const validStaff = { full_name: "Mr. T. Ndlovu" };

  it("validates a minimal valid staff member", () => {
    expect(staffFormSchema.safeParse(validStaff).success).toBe(true);
  });

  it("defaults role to teacher", () => {
    const r = staffFormSchema.safeParse(validStaff);
    if (r.success) expect(r.data.role).toBe("teacher");
  });

  it("accepts valid national ID", () => {
    expect(staffFormSchema.safeParse({ ...validStaff, national_id: "63-123456-A-00" }).success).toBe(true);
  });

  it("rejects invalid national ID", () => {
    expect(staffFormSchema.safeParse({ ...validStaff, national_id: "invalid-id" }).success).toBe(false);
  });

  it("accepts subjects_taught array", () => {
    expect(staffFormSchema.safeParse({ ...validStaff, subjects_taught: ["Mathematics", "Physical Sciences"] }).success).toBe(true);
  });
});
