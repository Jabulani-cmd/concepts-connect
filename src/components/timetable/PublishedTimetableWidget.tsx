import { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Radio } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { colorForSubject, dayName } from "@/lib/timetableUtils";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  title?: string;
  /** "class" filters by class label; "teacher" filters by teacher name; "all" shows raw class view */
  mode?: "class" | "teacher" | "all";
  /** Optional pre-filter value (e.g. class label or teacher name) */
  filterValue?: string;
  compact?: boolean;
}

export default function PublishedTimetableWidget({
  title = "Published Timetable",
  mode = "class",
  filterValue,
  compact = false,
}: Props) {
  const [defs, setDefs] = useState<Tables<"tt_definitions">[]>([]);
  const [slots, setSlots] = useState<Tables<"tt_slots">[]>([]);
  const [selectedDefId, setSelectedDefId] = useState<string>("");
  const [filter, setFilter] = useState<string>(filterValue ?? "");
  const [live, setLive] = useState(false);

  const load = useCallback(async () => {
    const { data: d } = await supabase
      .from("tt_definitions")
      .select("*")
      .eq("type", "class")
      .eq("status", "active")
      .order("updated_at", { ascending: false });
    const activeDefs = d ?? [];
    setDefs(activeDefs);
    if (activeDefs.length) {
      // Auto-pick (by class_label when the caller specified one) unless a timetable is already selected.
      let pick = activeDefs[0].id;
      if (mode === "class" && filterValue) {
        const match = activeDefs.find((x) => (x.class_label || "").toLowerCase() === filterValue.toLowerCase());
        if (match) pick = match.id;
      }
      setSelectedDefId((current) => current || pick);
    }
    const { data: s } = await supabase.from("tt_slots").select("*");
    setSlots(s ?? []);
  }, [filterValue, mode]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`published-timetable-sync-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "tt_slots" }, () => {
        setLive(true);
        load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tt_definitions" }, () => {
        setLive(true);
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const activeDef = defs.find((x) => x.id === selectedDefId);
  const defSlots = useMemo(() => slots.filter((s) => s.definition_id === selectedDefId), [slots, selectedDefId]);

  // For teacher mode, gather distinct teachers across slots
  const teachers = useMemo(() => {
    const set = new Set<string>();
    defSlots.forEach((s) => s.teacher_name && set.add(s.teacher_name));
    return Array.from(set).sort();
  }, [defSlots]);

  const filteredSlots = useMemo(() => {
    if (mode === "teacher" && filter && filter !== "__all__") return defSlots.filter((s) => s.teacher_name === filter);
    return defSlots;
  }, [defSlots, mode, filter]);

  const days = activeDef?.school_days ?? [1, 2, 3, 4, 5];
  const periods = useMemo(() => {
    const map = new Map<number, { start: string; end: string; isBreak: boolean; label?: string }>();
    filteredSlots.forEach((s) => {
      if (!map.has(s.period_index))
        map.set(s.period_index, { start: s.start_time, end: s.end_time, isBreak: s.is_break, label: s.break_label });
    });
    // also pull from full def slots so break rows show even if filter empties them
    defSlots.forEach((s) => {
      if (!map.has(s.period_index))
        map.set(s.period_index, { start: s.start_time, end: s.end_time, isBreak: s.is_break, label: s.break_label });
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [filteredSlots, defSlots]);

  const cell = (day: number, period: number) => {
    const s = filteredSlots.find((x) => x.day_of_week === day && x.period_index === period);
    if (!s) return null;
    if (s.is_break) return <div className="text-[10px] text-muted-foreground italic">{s.break_label || "Break"}</div>;
    if (!s.subject_name) return <div className="text-[10px] text-muted-foreground">-</div>;
    const color = s.subject_color || colorForSubject(s.subject_name);
    return (
      <div
        className="rounded px-1.5 py-1 text-[10px] leading-tight"
        style={{ background: `${color}22`, borderLeft: `3px solid ${color}` }}
      >
        <div className="font-semibold truncate">{s.subject_name}</div>
        {s.teacher_name && <div className="text-muted-foreground truncate">{s.teacher_name}</div>}
        {s.room && <div className="text-muted-foreground truncate">{s.room}</div>}
      </div>
    );
  };

  if (!defs.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" /> {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No published timetable yet.{" "}
          <Link to="/portal/timetables" className="text-primary underline">
            Open Timetable Management
          </Link>{" "}
          to create and publish one.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" /> {title}
            {live && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Radio className="h-3 w-3 animate-pulse text-green-500" /> Live
              </Badge>
            )}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={selectedDefId} onValueChange={setSelectedDefId}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Pick timetable" />
              </SelectTrigger>
              <SelectContent>
                {defs.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name} {d.class_label ? `· ${d.class_label}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {mode === "teacher" && (
              <Select value={filter || "__all__"} onValueChange={(v) => setFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder="All teachers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="text-xs">
                    All teachers
                  </SelectItem>
                  {teachers.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b bg-muted/50 p-1.5 text-left text-[10px] uppercase text-muted-foreground">
                  Time
                </th>
                {days.map((d: number) => (
                  <th
                    key={d}
                    className="border-b bg-muted/50 p-1.5 text-left text-[10px] uppercase text-muted-foreground"
                  >
                    {dayName(d).slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periods.map(([p, t]) => (
                <tr key={p}>
                  <td className="border-b p-1.5 align-top text-[10px] text-muted-foreground whitespace-nowrap">
                    {t.start}–{t.end}
                  </td>
                  {days.map((d: number) => (
                    <td key={d} className="border-b p-1 align-top" style={{ minWidth: compact ? 90 : 120 }}>
                      {cell(d, p)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
