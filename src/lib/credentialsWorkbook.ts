import type { Teacher, Subject, SchoolClass } from "@/contexts/AllocationContext";
import type { DemoStudent, DemoParent } from "@/lib/demoSeeder";
import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORDS } from "@/lib/demoSeeder";
import { demoFeeStatus, demoSubscriptionPaid } from "@/lib/demoAccounts";
import { DEMO_SUPPORT_STAFF, demoHeadsOfDepartment } from "@/lib/demoStaff";
import { SCHOOL_CONTACT_LINE } from "@/lib/school";

export interface CredentialsInput {
  schoolName: string;
  loginUrl: string;
  teachers: Teacher[];
  subjects: Subject[];
  classes: SchoolClass[];
  students: DemoStudent[];
  parents: DemoParent[];
  generatedAt?: Date;
}

const BRAND = "FF6508C5"; // brand purple
const STRIPE = "FFF8F7FC";
const BORDER = "FFD9D6E3";

type Column = { header: string; key: string; width: number };

/**
 * Builds the demo login list as a formatted Excel workbook: an overview sheet and
 * one sheet each for staff, students and parents, with styled, frozen, filterable
 * headers. ExcelJS is loaded on demand so it never weighs down normal page loads.
 */
export async function buildCredentialsWorkbook(input: CredentialsInput): Promise<Blob> {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = input.schoolName;
  wb.created = input.generatedAt ?? new Date();

  const subjectName = new Map(input.subjects.map((s) => [s.id, s.name]));
  const studentById = new Map(input.students.map((s) => [s.id, s]));
  const className = (s: DemoStudent) => `Form ${s.form}${s.stream}`;
  const generated = (input.generatedAt ?? new Date()).toLocaleString("en-GB", { dateStyle: "long", timeStyle: "short" });

  // ---- Overview ----
  const ov = wb.addWorksheet("Overview", { views: [{ showGridLines: false }] });
  ov.columns = [{ width: 4 }, { width: 28 }, { width: 44 }, { width: 18 }];
  ov.mergeCells("B2:D2");
  ov.getCell("B2").value = `${input.schoolName}: Demo Login Credentials`;
  ov.getCell("B2").font = { bold: true, size: 16, color: { argb: BRAND } };
  ov.mergeCells("B3:D3");
  ov.getCell("B3").value = `Generated ${generated}. Demo accounts only. Keep this file private.`;
  ov.getCell("B3").font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  ov.mergeCells("B4:D4");
  ov.getCell("B4").value = SCHOOL_CONTACT_LINE;
  ov.getCell("B4").font = { size: 10, color: { argb: "FF6B7280" } };

  const summary: [string, string | number, string][] = [
    ["Sign-in page", input.loginUrl, ""],
    ["Administrator", `admin@${DEMO_EMAIL_DOMAIN}`, DEMO_PASSWORDS.admin],
    ["Leadership & support staff", DEMO_SUPPORT_STAFF.length, DEMO_PASSWORDS.staff],
    ["Teachers (incl. heads of department)", input.teachers.length, DEMO_PASSWORDS.teacher],
    ["Students", input.students.length, DEMO_PASSWORDS.student],
    ["Parents & guardians", input.parents.length, DEMO_PASSWORDS.parent],
  ];
  const head = ov.getRow(5);
  head.values = ["", "Account", "Email / count", "Password"];
  styleHeader(head, 2, 4);
  summary.forEach(([label, value, password], i) => {
    const row = ov.getRow(6 + i);
    row.values = ["", label, value, password];
    styleBody(row, 2, 4, i);
    row.getCell(2).font = { bold: true };
  });
  ov.getCell("C6").value = { text: input.loginUrl, hyperlink: input.loginUrl };
  ov.getCell("C6").font = { color: { argb: "FF2563EB" }, underline: true };
  ov.getCell("B13").value = "Each sheet lists one group. Use the filter arrows in the header row to find a class, form or person.";
  ov.getCell("B13").font = { size: 10, color: { argb: "FF6B7280" } };
  ov.getCell("B14").value = "Payments demo: parents marked \"Not paid\" in the Parents sheet see locked portals (and so do their children) until they choose a plan and pay. School fee balances can be paid online from any parent's Fees tab. All payments are demo payments: no real money moves.";
  ov.getCell("B14").font = { size: 10, color: { argb: "FF6508C5" } };

  // ---- Staff: administrator, leadership and support staff, then teachers ----
  const heads = demoHeadsOfDepartment(input.teachers, input.subjects);
  addTable(wb, "Staff", [
    { header: "Staff No.", key: "no", width: 11 },
    { header: "Name", key: "name", width: 30 },
    { header: "Position", key: "position", width: 32 },
    { header: "Subjects", key: "subjects", width: 42 },
    { header: "Class teacher of", key: "classes", width: 18 },
    { header: "Email (login)", key: "email", width: 42 },
    { header: "Password", key: "password", width: 15 },
  ], [
    { no: "-", name: "Demo Administrator", position: "System Administrator", subjects: "Full system access", classes: "", email: `admin@${DEMO_EMAIL_DOMAIN}`, password: DEMO_PASSWORDS.admin },
    ...DEMO_SUPPORT_STAFF.map((m, i) => ({
      no: `S${String(i + 1).padStart(3, "0")}`,
      name: m.name,
      position: m.position,
      subjects: "",
      classes: "",
      email: m.email,
      password: DEMO_PASSWORDS.staff,
    })),
    ...input.teachers.map((t) => ({
      no: t.employeeNumber,
      name: t.name,
      position: heads.has(t.id) ? `Head of Department (${heads.get(t.id)})` : "Teacher",
      subjects: t.qualifiedSubjects.map((id) => subjectName.get(id)).filter(Boolean).join(", "),
      classes: input.classes.filter((c) => c.classTeacherId === t.id).map((c) => c.name).join(", "),
      email: t.email,
      password: DEMO_PASSWORDS.teacher,
    })),
  ]);

  // ---- Students (by class, then surname) ----
  const surname = (n: string) => n.split(" ").slice(-1)[0];
  const students = [...input.students].sort((a, b) =>
    a.form - b.form || a.stream.localeCompare(b.stream) || surname(a.fullName).localeCompare(surname(b.fullName)) || a.fullName.localeCompare(b.fullName));
  addTable(wb, "Students", [
    { header: "Admission No.", key: "adm", width: 15 },
    { header: "Name", key: "name", width: 28 },
    { header: "Form", key: "form", width: 9 },
    { header: "Class", key: "class", width: 10 },
    { header: "Boarding", key: "boarding", width: 11 },
    { header: "Portal access", key: "access", width: 26 },
    { header: "School fees", key: "fees", width: 12 },
    { header: "Email (login)", key: "email", width: 46 },
    { header: "Password", key: "password", width: 15 },
  ], students.map((s) => ({
    adm: s.admissionNumber,
    name: s.fullName,
    form: `Form ${s.form}`,
    class: className(s),
    boarding: s.boarding ? "Boarder" : "Day",
    access: demoSubscriptionPaid(s.admissionNumber) ? "Open (parent subscribed)" : "Locked (parent not paid)",
    fees: demoFeeStatus(s.admissionNumber),
    email: s.email,
    password: s.password,
  })));

  // ---- Parents (by surname) ----
  const parents = [...input.parents].sort((a, b) => surname(a.fullName).localeCompare(surname(b.fullName)) || a.fullName.localeCompare(b.fullName));
  addTable(wb, "Parents", [
    { header: "Name", key: "name", width: 30 },
    { header: "Relationship", key: "rel", width: 14 },
    { header: "Children (class)", key: "children", width: 44 },
    { header: "Phone", key: "phone", width: 16 },
    { header: "Subscription", key: "sub", width: 34 },
    { header: "Email (login)", key: "email", width: 48 },
    { header: "Password", key: "password", width: 15 },
  ], parents.map((p) => ({
    name: p.fullName,
    rel: p.relationship,
    children: (p.childIds ?? [])
      .map((id) => studentById.get(id))
      .filter((s): s is DemoStudent => !!s)
      .map((s) => `${s.fullName} (${className(s)})`)
      .join(", "),
    phone: p.phone,
    sub: (() => {
      const kids = (p.childIds ?? []).map((id) => studentById.get(id)).filter((s): s is DemoStudent => !!s);
      const unpaid = kids.filter((k) => !demoSubscriptionPaid(k.admissionNumber));
      if (!unpaid.length) return "Paid";
      if (unpaid.length === kids.length) return "Not paid: use to demo the payment";
      return `Not paid for ${unpaid.map((k) => k.fullName.split(" ")[0]).join(", ")}`;
    })(),
    email: p.email,
    password: p.password,
  })));

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function addTable(wb: import("exceljs").Workbook, name: string, columns: Column[], rows: Record<string, string>[]) {
  const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1, showGridLines: false }] });
  ws.columns = columns;
  styleHeader(ws.getRow(1), 1, columns.length);
  rows.forEach((r, i) => styleBody(ws.addRow(r), 1, columns.length, i));
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: "1:1" };
}

function styleHeader(row: import("exceljs").Row, from: number, to: number) {
  row.height = 22;
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    cell.border = { bottom: { style: "thin", color: { argb: BRAND } } };
  }
}

function styleBody(row: import("exceljs").Row, from: number, to: number, index: number) {
  row.height = 18;
  for (let c = from; c <= to; c++) {
    const cell = row.getCell(c);
    cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: false };
    cell.border = { bottom: { style: "hair", color: { argb: BORDER } } };
    if (index % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE } };
  }
  const last = row.getCell(to);
  last.font = { name: "Consolas", color: { argb: "FF374151" } };
}
