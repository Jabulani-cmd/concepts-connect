// Year / month / day filter used by the finance tables and DateRangeFilter.

export type FinanceDateFilter = {
  year: string; // 'all' or '2026'
  month: string; // 'all' or '0'..'11'
  day: string; // '' or 'YYYY-MM-DD'
};

export function emptyDateFilter(): FinanceDateFilter {
  return { year: "all", month: "all", day: "" };
}

export function dateMatches(filter: FinanceDateFilter, dateInput?: string | Date | null): boolean {
  if (!dateInput) return filter.year === "all" && filter.month === "all" && !filter.day;
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return false;
  if (filter.day) {
    const exact = new Date(filter.day);
    if (
      exact.getFullYear() !== d.getFullYear() ||
      exact.getMonth() !== d.getMonth() ||
      exact.getDate() !== d.getDate()
    )
      return false;
  }
  if (filter.year !== "all" && String(d.getFullYear()) !== filter.year) return false;
  if (filter.month !== "all" && String(d.getMonth()) !== filter.month) return false;
  return true;
}
