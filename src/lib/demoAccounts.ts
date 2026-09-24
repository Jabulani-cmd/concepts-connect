/** Sign-in details shared by the demo seeder, the login page and the credentials workbook. */
export const DEMO_EMAIL_DOMAIN = "schooldemo.com";
/**
 * Demo passwords. They must not be common passwords: Supabase's leaked-password
 * protection rejects ones like "Student@2025". Keep in step with DEMO_ADMIN in
 * supabase/functions/seed-demo-accounts.
 */
export const DEMO_PASSWORDS = {
  admin: "MbsDemo#Admin26",
  teacher: "MbsDemo#Teacher26",
  student: "MbsDemo#Student26",
  parent: "MbsDemo#Parent26",
} as const;
