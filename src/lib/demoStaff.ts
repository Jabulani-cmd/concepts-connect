// Leadership, administration and support staff for the demo school, and the heads of
// department chosen from the teaching staff. Fixed, so every load produces the same people
// and the same logins. Each person signs in to the portal for their `role`.
import type { Teacher, Subject } from "@/contexts/AllocationContext";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demoAccounts";

/** Portal roles held by non-teaching staff (see src/lib/portalHome.ts). */
export type SupportRole =
  | "principal" | "deputy_principal" | "admin_supervisor" | "bursar" | "finance_clerk"
  | "registration" | "boarding" | "nurse" | "librarian" | "storekeeper";

export interface DemoStaffMember {
  id: string;
  name: string;
  /** Job title as the school uses it. */
  position: string;
  /** Portal role: decides which portal the person signs in to. */
  role: SupportRole;
  /** Position saved on the staff record (staff.role). */
  staffRole: string;
  category: "leadership" | "administrative" | "support";
  department: string;
  email: string;
  phone: string;
}

const member = (
  n: number, name: string, position: string, role: SupportRole, staffRole: string,
  category: DemoStaffMember["category"], department: string, mailbox: string,
): DemoStaffMember => ({
  id: `s-${n}`, name, position, role, staffRole, category, department,
  email: `${mailbox}@${DEMO_EMAIL_DOMAIN}`,
  phone: `+26377${3000000 + n}`,
});

export const DEMO_SUPPORT_STAFF: DemoStaffMember[] = [
  member(1, "Mr. Tendai Mukwena", "Head (Principal)", "principal", "principal", "leadership", "Administration", "principal"),
  member(2, "Mrs. Rutendo Mashingaidze", "Deputy Head", "deputy_principal", "deputy_principal", "leadership", "Administration", "deputy"),
  member(3, "Mr. Blessing Gumbo", "School Administrator", "admin_supervisor", "school_administrator", "administrative", "Administration", "administrator"),
  member(4, "Mrs. Nyasha Chirisa", "Bursar", "bursar", "bursar", "administrative", "Finance", "bursar"),
  member(5, "Ms. Tariro Mbewe", "Accounts Clerk", "finance_clerk", "finance_clerk", "administrative", "Finance", "accounts"),
  member(6, "Mr. Kudakwashe Nyoni", "Fees Clerk", "finance_clerk", "finance_clerk", "administrative", "Finance", "fees"),
  member(7, "Mrs. Chipo Maposa", "School Secretary & Admissions", "registration", "secretary", "administrative", "Administration", "secretary"),
  member(8, "Mr. Simbarashe Ndlovu", "Boarding Master", "boarding", "housemaster", "support", "Boarding", "boarding"),
  member(9, "Mrs. Memory Sibanda", "Matron", "boarding", "matron", "support", "Boarding", "matron"),
  member(10, "Sister Grace Moyo", "Sister-in-Charge (School Nurse)", "nurse", "nurse", "support", "Sick Bay", "nurse"),
  member(11, "Mrs. Fadzai Chitsa", "Librarian", "librarian", "librarian", "support", "Library", "librarian"),
  member(12, "Mr. Tafadzwa Chuma", "Stores Clerk", "storekeeper", "stores_clerk", "support", "Stores", "stores"),
  member(13, "Mr. Tinashe Mapfumo", "Laboratory Technician", "storekeeper", "lab_technician", "support", "Sciences", "labtech"),
];

/** Department of each subject, used for staff records and to choose heads of department. */
export const DEPARTMENT: Record<string, string> = {
  Mathematics: "Mathematics", "Pure Mathematics": "Mathematics",
  "English Language": "Languages", Shona: "Languages",
  "Combined Science": "Sciences", Physics: "Sciences", Chemistry: "Sciences", Biology: "Sciences",
  History: "Humanities", Geography: "Humanities", "Heritage Studies": "Humanities",
  "Computer Science": "Technical", Agriculture: "Technical",
  "Physical Education": "Sports",
  "Principles of Accounting": "Commercials", Accounting: "Commercials", Commerce: "Commercials",
  "Business Studies": "Commercials", Economics: "Commercials",
};

/** A teacher's department: the department of their main (first) subject. */
export function teacherDepartment(t: Teacher, subjects: Subject[]): string {
  const main = subjects.find((s) => s.id === t.qualifiedSubjects[0])?.name ?? "";
  return DEPARTMENT[main] ?? "Teaching";
}

/**
 * One head of department per department: the first teacher (by staff number) whose main
 * subject is in it. HODs keep teaching, and sign in to the HOD portal.
 * Returns teacher id → department.
 */
export function demoHeadsOfDepartment(teachers: Teacher[], subjects: Subject[]): Map<string, string> {
  const heads = new Map<string, string>();
  const taken = new Set<string>();
  for (const t of teachers) {
    const dept = teacherDepartment(t, subjects);
    if (dept === "Teaching" || taken.has(dept)) continue;
    taken.add(dept);
    heads.set(t.id, dept);
  }
  return heads;
}
