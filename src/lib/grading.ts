/**
 * Zimbabwean (ZIMSEC O-Level style) grading used across the portal.
 * Adjust the bands here if the school uses different cut-offs; every screen reads from this table.
 */
export const GRADE_BANDS = [
  { grade: "A", min: 75, label: "Distinction" },
  { grade: "B", min: 65, label: "Merit" },
  { grade: "C", min: 50, label: "Credit" },
  { grade: "D", min: 45, label: "Satisfactory" },
  { grade: "E", min: 40, label: "Sufficient" },
  { grade: "U", min: 0, label: "Ungraded" },
] as const;

export type Grade = (typeof GRADE_BANDS)[number]["grade"];

/** Lowest percentage that counts as a pass (grade C or better). */
export const PASS_MARK = 50;

/** Letter grade for a percentage (0–100). */
export function gradeFor(percent: number | null | undefined): Grade {
  const p = Number(percent) || 0;
  return (GRADE_BANDS.find((b) => p >= b.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]).grade;
}

export function gradeLabel(grade: string | null | undefined): string {
  return GRADE_BANDS.find((b) => b.grade === grade)?.label ?? "";
}

const GRADE_STYLES: Record<Grade, string> = {
  A: "bg-emerald-100 text-emerald-800 border-emerald-300",
  B: "bg-purple-100 text-purple-800 border-purple-300",
  C: "bg-gray-100 text-gray-800 border-gray-300",
  D: "bg-amber-100 text-amber-800 border-amber-300",
  E: "bg-orange-100 text-orange-800 border-orange-300",
  U: "bg-red-100 text-red-800 border-red-300",
};

/** Tailwind classes for a grade badge. */
export function gradeBadgeClass(grade: string | null | undefined): string {
  return GRADE_STYLES[grade as Grade] ?? "bg-muted text-muted-foreground";
}

/** Tailwind text colour for a grade shown inline. */
export function gradeTextClass(grade: string | null | undefined): string {
  switch (grade) {
    case "A":
      return "text-emerald-600";
    case "B":
      return "text-purple-600";
    case "C":
      return "text-gray-600";
    case "D":
    case "E":
      return "text-amber-600";
    default:
      return "text-red-600";
  }
}
