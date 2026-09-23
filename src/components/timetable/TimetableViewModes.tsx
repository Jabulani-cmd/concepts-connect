import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlotRow, PeriodTimes, buildPeriodSchedule, colorForSubject, dayName } from "@/lib/timetableUtils";

interface DefMeta {
  id: string; name: string; class_label: string | null;
  day_start_time: string; period_minutes: number; periods_per_day: number;
  school_days: number[]; breaks: any;
}

interface Props {
  defs: DefMeta[];
  allSlots: SlotRow[];           // slots across all definitions
  mode: "master" | "class" | "teacher" | "room" | "student";
  setMode: (m: any) => void;
  filter: string;
  setFilter: (s: string) => void;
}

export default function TimetableViewModes({ defs, allSlots, mode, setMode, filter, setFilter }: Props) {
  // Compute filter options based on mode
  const options = useMemo(() => {
    if (mode === "class") return defs.map((d) => d.class_label || d.name).filter(Boolean) as string[];
    if (mode === "teacher") return Array.from(new Set(allSlots.map((s) => s.teacher_name).filter(Boolean))) as string[];
    if (mode === "room") return Array.from(new Set(allSlots.map((s) => s.room).filter(Boolean))) as string[];
    if (mode === "student") return defs.map((d) => d.class_label || d.name); // student = pick their class
    return [];
  }, [mode, defs, allSlots]);

  const visibleSlots = useMemo(() => {
    if (mode === "master") return allSlots;
    if (mode === "class" || mode === "student") {
      const def = defs.find((d) => (d.class_label || d.name) === filter);
      if (!def) return [];
      return allSlots.filter((s) => s.definition_id === def.id);
    }
    if (mode === "teacher") return allSlots.filter((s) => s.teacher_name === filter);
    if (mode === "room") return allSlots.filter((s) => s.room === filter);
    return [];
  }, [mode, filter, defs, allSlots]);

  // For grid layout, use the first matching def's schedule (or union)
  const refDef = defs[0];
  const schedule: PeriodTimes[] = useMemo(() => {
    if (!refDef) return [];
    return buildPeriodSchedule(refDef.day_start_time, refDef.period_minutes, refDef.periods_per_day, refDef.breaks ?? []);
  }, [refDef]);

  const allDays = useMemo(() => {
    const set = new Set<number>();
    for (const d of defs) for (const day of d.school_days ?? []) set.add(day);
    return Array.from(set).sort();
  }, [defs]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">View:</span>
        {(["master", "class", "teacher", "room", "student"] as const).map((m) => (
          <button key={m} onClick={() => { setMode(m); setFilter(""); }}
            className={`px-3 py-1 text-xs rounded-full border ${mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
            {m.charAt(0).toUpperCase() + m.slice(1)}
          </button>
        ))}
        {mode !== "master" && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-60 h-8"><SelectValue placeholder={`Select ${mode}…`} /></SelectTrigger>
            <SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <Card>
        <CardContent className="p-0 overflow-auto">
          {!refDef ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No timetable data yet.</div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-background z-10">
                <tr>
                  <th className="p-2 border-b text-left w-24">Time</th>
                  {allDays.map((d) => <th key={d} className="p-2 border-b text-left">{dayName(d)}</th>)}
                </tr>
              </thead>
              <tbody>
                {schedule.map((p, ridx) => {
                  if (p.isBreak) {
                    return (
                      <tr key={`b-${ridx}`} className="bg-muted/40">
                        <td className="p-2 font-semibold">{p.start}–{p.end}<br /><span className="text-muted-foreground">{p.label}</span></td>
                        {allDays.map((d) => <td key={d} className="p-2 italic text-center text-muted-foreground">{p.label}</td>)}
                      </tr>
                    );
                  }
                  return (
                    <tr key={`p-${p.index}`}>
                      <td className="p-2 font-semibold border-b">{p.start}–{p.end}</td>
                      {allDays.map((d) => {
                        const cellSlots = visibleSlots.filter((s) => s.day_of_week === d && s.period_index === p.index && !s.is_break && s.subject_name);
                        if (cellSlots.length === 0) return <td key={d} className="p-1 border-b">&nbsp;</td>;
                        return (
                          <td key={d} className="p-1 border-b align-top">
                            <div className="space-y-1">
                              {cellSlots.map((s) => {
                                const def = defs.find((x) => x.id === s.definition_id);
                                return (
                                  <div key={s.id} className="px-2 py-1 rounded text-[11px]"
                                    style={{ borderLeft: `3px solid ${s.subject_color ?? colorForSubject(s.subject_name)}`, background: "var(--background)" }}>
                                    <div className="font-semibold">{s.subject_name}</div>
                                    <div className="text-muted-foreground">{s.teacher_name} · {s.room}</div>
                                    {mode === "master" && def && <Badge variant="outline" className="text-[9px] mt-0.5">{def.class_label || def.name}</Badge>}
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
