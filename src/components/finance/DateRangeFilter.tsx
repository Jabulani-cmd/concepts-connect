// Reusable Year / Month / Day filter for finance tables; pair with `dateMatches` from @/lib/finance/dateFilter.
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CalendarRange, X } from "lucide-react";
import { emptyDateFilter, type FinanceDateFilter } from "@/lib/finance/dateFilter";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface Props {
  value: FinanceDateFilter;
  onChange: (v: FinanceDateFilter) => void;
  years?: string[]; // optional list of years derived from data
  className?: string;
}

export default function DateRangeFilter({ value, onChange, years, className }: Props) {
  const currentYear = new Date().getFullYear();
  const yearList = years && years.length > 0
    ? years
    : Array.from({ length: 6 }, (_, i) => String(currentYear - i));

  const isFiltering = value.year !== "all" || value.month !== "all" || !!value.day;

  return (
    <div className={`flex flex-wrap items-end gap-2 ${className || ""}`}>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <CalendarRange className="h-3.5 w-3.5" /> Filter by:
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Year</Label>
        <Select value={value.year} onValueChange={(v) => onChange({ ...value, year: v })}>
          <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {yearList.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Month</Label>
        <Select value={value.month} onValueChange={(v) => onChange({ ...value, month: v })}>
          <SelectTrigger className="h-8 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Months</SelectItem>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Exact date</Label>
        <Input
          type="date"
          className="h-8 w-[160px]"
          value={value.day}
          onChange={(e) => onChange({ ...value, day: e.target.value })}
        />
      </div>
      {isFiltering && (
        <Button variant="ghost" size="sm" className="h-8" onClick={() => onChange(emptyDateFilter())}>
          <X className="mr-1 h-3.5 w-3.5" /> Clear
        </Button>
      )}
    </div>
  );
}
