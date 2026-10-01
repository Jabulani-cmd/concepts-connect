/** Sign-in details shared by the demo seeder, the login page and the credentials workbook. */
export const DEMO_EMAIL_DOMAIN = "schooldemo.com";

/** Student logins are <student number>@concepts-academy.co.zw, for real and demo learners alike. */
export const STUDENT_EMAIL_DOMAIN = "concepts-academy.co.zw";
export const studentEmail = (studentNumber: string) => `${studentNumber.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;

/**
 * Demo learners use a reserved block of student numbers, CLA90001 to CLA99999, so they
 * look exactly like real learners but can never clash with them (real numbers count up
 * from CLA00001). The demo tools only ever create or reset accounts in this block.
 */
export const DEMO_STUDENT_NUMBER_START = 90001;
export const demoStudentNumber = (index: number) => `CLA${DEMO_STUDENT_NUMBER_START + index}`;
export const DEMO_STUDENT_EMAIL = /^cla9\d{4}@concepts-academy\.co\.zw$/i;
/** Student numbers used by the first version of the demo (STU0001 ...), cleared on the next load. */
export const legacyDemoStudentNumbers = (count: number) => Array.from({ length: count }, (_, i) => `STU${String(i + 1).padStart(4, "0")}`);

/** A demo account: anything on the demo domain, or a learner in the reserved demo block. */
export function isDemoEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  return e.endsWith(`@${DEMO_EMAIL_DOMAIN}`) || e.endsWith(`.${DEMO_EMAIL_DOMAIN}`) || DEMO_STUDENT_EMAIL.test(e);
}
/**
 * Demo passwords. They must not be common passwords: Supabase's leaked-password
 * protection rejects ones like "Student@2025". Keep in step with DEMO_ADMIN in
 * supabase/functions/seed-demo-accounts.
 */
export const DEMO_PASSWORDS = {
  admin: "MbsDemo#Admin26",
  /** Leadership, office and support staff (principal, bursar, matron, librarian, ...). */
  staff: "MbsDemo#Staff26",
  teacher: "MbsDemo#Teacher26",
  student: "MbsDemo#Student26",
  parent: "MbsDemo#Parent26",
} as const;

/**
 * The demo billing picture, decided by the student number exactly as the database
 * function seed_demo_billing() does (keep the two in step): one family in four has
 * not paid the portal subscription; of the fee invoices about 45% are paid in full,
 * 30% part-paid and 25% unpaid.
 */
const demoNumber = (admissionNumber: string) => Number(admissionNumber.replace(/\D/g, "")) || 0;
export const demoSubscriptionPaid = (admissionNumber: string) => demoNumber(admissionNumber) % 4 !== 3;
export function demoFeeStatus(admissionNumber: string): "Paid" | "Part-paid" | "Unpaid" {
  const r = demoNumber(admissionNumber) % 20;
  return r < 9 ? "Paid" : r < 15 ? "Part-paid" : "Unpaid";
}
