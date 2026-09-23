import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { buildCredentialsWorkbook } from "@/lib/credentialsWorkbook";
import { generateDemoSeed } from "@/lib/demoSeeder";

describe("login credentials workbook", () => {
  it("has a readable sheet per group with one row per person", async () => {
    const seed = generateDemoSeed();
    const blob = await buildCredentialsWorkbook({
      schoolName: "MavingTech High School", loginUrl: "https://example.test/login",
      teachers: seed.teachers, subjects: seed.subjects, classes: seed.classes,
      students: seed.students, parents: seed.parents, generatedAt: new Date("2026-09-23T10:00:00Z"),
    });
    const wb = new ExcelJS.Workbook();
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
    await wb.xlsx.load(bytes);

    expect(wb.worksheets.map((w) => w.name)).toEqual(["Overview", "Staff", "Students", "Parents"]);
    const students = wb.getWorksheet("Students")!;
    expect(students.getRow(1).values).toEqual([undefined, "Admission No.", "Name", "Form", "Class", "Boarding", "Email (login)", "Password"]);
    expect(students.rowCount).toBe(1 + seed.students.length);
    expect(students.getRow(2).getCell(4).value).toBe("Form 1A");
    expect(students.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(wb.getWorksheet("Staff")!.rowCount).toBe(1 + 1 + seed.teachers.length);
    expect(wb.getWorksheet("Parents")!.rowCount).toBe(1 + seed.parents.length);
    const firstParent = wb.getWorksheet("Parents")!.getRow(2);
    expect(String(firstParent.getCell(3).value)).toMatch(/\(Form [1-6][ABC]\)/);
  });
});
