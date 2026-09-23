import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Plus, Sparkles, Calendar, Download, Printer, AlertTriangle, Trash2, Pencil, Copy, Eye, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import TimetableSetupDialog, { SetupValue } from "@/components/timetable/TimetableSetupDialog";
import TimetableGridBuilder from "@/components/timetable/TimetableGridBuilder";
import AIGenerationOverlay from "@/components/timetable/AIGenerationOverlay";
import TimetableViewModes from "@/components/timetable/TimetableViewModes";
import TimetableAnalytics from "@/components/timetable/TimetableAnalytics";
import SubstitutionFinder from "@/components/timetable/SubstitutionFinder";
import ExamTimetableBuilder from "@/components/timetable/ExamTimetableBuilder";
import { buildPeriodSchedule, colorForSubject, dayName, SlotRow, printableTimetableHtml, type BreakSpec } from "@/lib/timetableUtils";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { errorMessage } from "@/lib/errors";

type DefSettings = Partial<Pick<SetupValue, "aiMode" | "subjects" | "constraints" | "freeText">>;

// tt_definitions row with its JSON columns given their real shapes.
type Def = Omit<Tables<"tt_definitions">, "type" | "status" | "breaks" | "settings"> & {
  type: "class" | "exam";
  status: "draft" | "active" | "archived";
  breaks: BreakSpec[] | null;
  settings: DefSettings | null;
};
const toDef = (row: Tables<"tt_definitions">) => row as unknown as Def;

type AiSlot = { day: number; period: number; subject: string; teacher?: string; room?: string; reasoning?: string };

export default function TimetableManagement() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"class" | "exam">("class");
  const [aiMode, setAiMode] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [defs, setDefs] = useState<Def[]>([]);
  const [allSlots, setAllSlots] = useState<SlotRow[]>([]);
  const [examSlots, setExamSlots] = useState<Tables<"tt_exam_slots">[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [view, setView] = useState<"list" | "builder" | "views" | "analytics">("list");
  const [viewMode, setViewMode] = useState<"master" | "class" | "teacher" | "room" | "student">("master");
  const [viewFilter, setViewFilter] = useState("");

  const loadAll = async () => {
    const { data: defData } = await supabase.from("tt_definitions").select("*").order("updated_at", { ascending: false });
    setDefs((defData ?? []).map(toDef));
    const { data: slotData } = await supabase.from("tt_slots").select("*");
    setAllSlots(slotData ?? []);
    const { data: examData } = await supabase.from("tt_exam_slots").select("*");
    setExamSlots(examData ?? []);
  };

  useEffect(() => { loadAll(); }, []);

  const filteredDefs = defs.filter((d) => d.type === tab);
  const activeDef = defs.find((d) => d.id === activeId) || null;
  const activeSlots = useMemo(() => allSlots.filter((s) => s.definition_id === activeId), [allSlots, activeId]);
  const activeExamSlots = useMemo(() => examSlots.filter((s) => s.definition_id === activeId), [examSlots, activeId]);

  const summary = useMemo(() => {
    const total = defs.length;
    const active = defs.filter((d) => d.status === "active").length;
    const next = defs.filter((d) => d.type === "exam" && d.start_date && new Date(d.start_date) >= new Date()).sort((a, b) => (a.start_date! < b.start_date! ? -1 : 1))[0];
    return { total, active, next };
  }, [defs]);

  const createTimetable = async (v: SetupValue) => {
    const insert = {
      name: v.name || `${v.classLabel} ${v.term}`,
      type: v.type, class_label: v.classLabel, term: v.term, academic_year: v.academicYear,
      start_date: v.startDate || null, end_date: v.endDate || null,
      school_days: v.schoolDays, period_minutes: v.periodMinutes, periods_per_day: v.periodsPerDay,
      day_start_time: v.dayStartTime, breaks: v.breaks, status: "draft",
      settings: { aiMode: v.aiMode, subjects: v.subjects, constraints: v.constraints, freeText: v.freeText },
    };
    const { data, error } = await supabase.from("tt_definitions").insert(insert).select().single();
    if (error) { toast({ variant: "destructive", title: "Create failed", description: error.message }); return; }
    const def = toDef(data);

    if (v.type === "class") {
      // Generate skeleton break slots only (teaching cells stay empty until assigned)
      const schedule = buildPeriodSchedule(v.dayStartTime, v.periodMinutes, v.periodsPerDay, v.breaks);
      const rows: TablesInsert<"tt_slots">[] = [];
      let counter = -1000;
      for (const day of v.schoolDays) {
        for (const p of schedule) {
          if (p.isBreak) {
            rows.push({
              definition_id: def.id, day_of_week: day, period_index: counter--,
              start_time: p.start, end_time: p.end, is_break: true, break_label: p.label,
            });
          }
        }
      }
      if (rows.length) await supabase.from("tt_slots").insert(rows);
    }

    if (v.aiMode && v.type === "class") {
      await runAIGeneration(def, v);
    }
    await loadAll();
    setActiveId(def.id);
    setView("builder");
  };

  const runAIGeneration = async (def: Def, v: DefSettings, feedback?: string) => {
    if (def.type !== "class") return;
    setAiBusy(true);
    try {
      const meta = {
        name: def.name, classLabel: def.class_label, term: def.term, academicYear: def.academic_year,
        schoolDays: def.school_days, periodMinutes: def.period_minutes, periodsPerDay: def.periods_per_day,
        dayStartTime: def.day_start_time, breaks: def.breaks,
      };
      const payload = {
        meta,
        subjects: v.subjects?.length ? v.subjects : (def.settings?.subjects ?? []),
        constraints: v.constraints ?? def.settings?.constraints,
        freeText: feedback || v.freeText || def.settings?.freeText,
      };
      const { data, error } = await supabase.functions.invoke("ai-generate-timetable", { body: payload });
      if (error) throw error;
      // wipe existing non-break slots
      await supabase.from("tt_slots").delete().eq("definition_id", def.id).eq("is_break", false);
      const schedule = buildPeriodSchedule(def.day_start_time, def.period_minutes, def.periods_per_day, def.breaks);
      const rows = ((data?.slots ?? []) as AiSlot[]).map((s): TablesInsert<"tt_slots"> | null => {
        const p = schedule.find((x) => x.index === s.period && !x.isBreak);
        if (!p) return null;
        return {
          definition_id: def.id, day_of_week: s.day, period_index: s.period,
          start_time: p.start, end_time: p.end, is_break: false,
          subject_name: s.subject, subject_color: colorForSubject(s.subject),
          teacher_name: s.teacher ?? null, room: s.room ?? null, notes: s.reasoning ?? null,
        };
      }).filter((r): r is TablesInsert<"tt_slots"> => r !== null);
      if (rows.length) await supabase.from("tt_slots").insert(rows);
      await supabase.from("ai_timetable_logs").insert({
        definition_id: def.id, feature: feedback ? "regenerate" : "generate_class",
        prompt_sent: payload as unknown as Json, response_received: data as Json, warnings: data?.warnings ?? [],
        conflicts_count: 0, optimization_score: data?.score ?? null, generation_time_ms: data?.generation_time_ms ?? null,
      });
      toast({ title: "AI timetable generated", description: data?.summary ?? "Done" });
    } catch (e) {
      toast({ variant: "destructive", title: "AI generation failed", description: errorMessage(e) });
    } finally {
      setAiBusy(false);
      await loadAll();
    }
  };

  const saveSlots = async (slotsToSave: SlotRow[]) => {
    if (!activeDef) return;
    await supabase.from("tt_slots").delete().eq("definition_id", activeDef.id);
    const rows = slotsToSave.map((s) => ({ ...s, definition_id: activeDef.id }));
    if (rows.length) {
      const { error } = await supabase.from("tt_slots").insert(rows.map(({ id, ...r }) => r));
      if (error) { toast({ variant: "destructive", title: "Save failed", description: error.message }); return; }
    }
    toast({ title: "Saved" });
    await loadAll();
  };

  const publish = async () => {
    if (!activeDef) return;
    try {
      // Mirror published tt_slots into timetable_entries so student/teacher/parent
      // portals (which read from timetable_entries) see the same single source of truth.
      if (activeDef.type === "class" && activeDef.class_label) {
        const { data: cls } = await supabase
          .from("classes").select("id").eq("name", activeDef.class_label).maybeSingle();
        if (cls?.id) {
          const { data: slotRows } = await supabase
            .from("tt_slots").select("*")
            .eq("definition_id", activeDef.id).eq("is_break", false);
          const teaching = (slotRows ?? []).filter((s) => s.subject_name);
          const subjectNames = Array.from(new Set(teaching.map((s) => s.subject_name)));
          const teacherNames = Array.from(new Set(teaching.map((s) => s.teacher_name).filter(Boolean)));
          const [subsRes, stfRes] = await Promise.all([
            subjectNames.length
              ? supabase.from("subjects").select("id,name").in("name", subjectNames)
              : Promise.resolve({ data: [] as { id: string; name: string }[] }),
            teacherNames.length
              ? supabase.from("staff").select("id,full_name").in("full_name", teacherNames)
              : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
          ]);
          const subMap = new Map((subsRes.data ?? []).map((r) => [r.name, r.id]));
          const stfMap = new Map((stfRes.data ?? []).map((r) => [r.full_name, r.id]));
          const entryRows = teaching.map((s) => ({
            class_id: cls.id,
            subject_id: subMap.get(s.subject_name) ?? null,
            teacher_id: s.teacher_name ? (stfMap.get(s.teacher_name) ?? null) : null,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            room: s.room ?? null,
            term: activeDef.term ?? null,
          }));
          await supabase.from("timetable_entries").delete().eq("class_id", cls.id);
          if (entryRows.length) {
            const { error: insErr } = await supabase.from("timetable_entries").insert(entryRows);
            if (insErr) throw insErr;
          }
        }
      }
      const { error } = await supabase.from("tt_definitions").update({ status: "active" }).eq("id", activeDef.id);
      if (error) throw error;
      toast({ title: "Published", description: "Timetable is now live across all portals." });
      await loadAll();
    } catch (e) {
      toast({ variant: "destructive", title: "Publish failed", description: errorMessage(e) });
    }
  };

  const duplicate = async (def: Def) => {
    const { id: _id, created_at: _created, updated_at: _updated, ...copy } = def;
    const { data: newDef } = await supabase.from("tt_definitions").insert({
      ...copy,
      name: def.name + " (copy)",
      status: "draft",
      breaks: copy.breaks as unknown as Json,
      settings: copy.settings as unknown as Json,
    }).select().single();
    if (!newDef) return;
    const mySlots = allSlots.filter((s) => s.definition_id === def.id);
    if (mySlots.length) {
      await supabase.from("tt_slots").insert(mySlots.map(({ id, definition_id, ...r }) => ({ ...r, definition_id: newDef.id })));
    }
    toast({ title: "Duplicated" });
    await loadAll();
  };

  const remove = async (def: Def) => {
    if (!confirm(`Delete timetable "${def.name}"?`)) return;
    await supabase.from("tt_definitions").delete().eq("id", def.id);
    if (activeId === def.id) { setActiveId(null); setView("list"); }
    await loadAll();
  };

  const printDef = (def: Def) => {
    const schedule = buildPeriodSchedule(def.day_start_time, def.period_minutes, def.periods_per_day, def.breaks ?? []);
    const html = printableTimetableHtml(def.name, def.school_days, schedule, allSlots.filter((s) => s.definition_id === def.id));
    const w = window.open("", "_blank"); if (w) { w.document.write(html); w.document.close(); }
  };

  const exportCsv = () => {
    const rows = [["Definition", "Class", "Day", "Period", "Start", "End", "Subject", "Teacher", "Room"]];
    for (const s of allSlots) {
      if (s.is_break) continue;
      const def = defs.find((d) => d.id === s.definition_id);
      rows.push([def?.name ?? "", def?.class_label ?? "", dayName(s.day_of_week), String(s.period_index + 1),
        s.start_time, s.end_time, s.subject_name ?? "", s.teacher_name ?? "", s.room ?? ""]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "timetables.csv"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="container max-w-7xl mx-auto p-4 space-y-4">
      <AIGenerationOverlay active={aiBusy} />

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Timetable Management</h1>
          <p className="text-sm text-muted-foreground">Build, generate and distribute class & exam timetables.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border bg-gradient-to-r from-purple-50 to-fuchsia-50 dark:from-purple-950/40 dark:to-fuchsia-950/40">
            <Label htmlFor="ai-switch" className="text-xs cursor-pointer">{aiMode ? "✨ AI Mode" : "Manual Mode"}</Label>
            <Switch id="ai-switch" checked={aiMode} onCheckedChange={setAiMode} />
          </div>
          <Button onClick={() => setSetupOpen(true)} className={aiMode ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700" : ""}>
            {aiMode ? <Sparkles className="h-4 w-4 mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
            Create New Timetable
          </Button>
        </div>
      </div>

      {view === "list" && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total timetables", value: summary.total, icon: <Calendar className="h-4 w-4" /> },
              { label: "Active", value: summary.active, icon: <Eye className="h-4 w-4" /> },
              { label: "Pending conflicts", value: allSlots.length ? 0 : 0, icon: <AlertTriangle className="h-4 w-4" /> },
              { label: "Next exam period", value: summary.next?.start_date ?? "—", icon: <Calendar className="h-4 w-4" /> },
            ].map((c, i) => (
              <Card key={i}><CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">{c.label}{c.icon}</div>
                <div className="text-2xl font-bold mt-1">{c.value}</div>
              </CardContent></Card>
            ))}
          </div>

          <Tabs value={tab} onValueChange={(t) => setTab(t as "class" | "exam")}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <TabsList>
                <TabsTrigger value="class">Class Timetables</TabsTrigger>
                <TabsTrigger value="exam">Exam Timetables</TabsTrigger>
              </TabsList>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={exportCsv}><Download className="h-3 w-3 mr-1" />Export CSV</Button>
                <Button variant="outline" size="sm" onClick={() => { setView("views"); setViewMode("master"); }}><Eye className="h-3 w-3 mr-1" />Views</Button>
                <Button variant="outline" size="sm" onClick={() => setView("analytics")}><BarChart3 className="h-3 w-3 mr-1" />Analytics</Button>
              </div>
            </div>

            <TabsContent value={tab} className="mt-3">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredDefs.length === 0 && (
                  <Card className="col-span-full"><CardContent className="p-8 text-center text-muted-foreground">
                    No {tab === "class" ? "class" : "exam"} timetables yet. Click "Create New Timetable" to get started.
                  </CardContent></Card>
                )}
                {filteredDefs.map((d) => {
                  const slots = allSlots.filter((s) => s.definition_id === d.id && !s.is_break && s.subject_name);
                  const teachers = new Set(slots.map((s) => s.teacher_name).filter(Boolean));
                  return (
                    <Card key={d.id} className="hover:shadow-md transition">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{d.name}</h3>
                            <p className="text-xs text-muted-foreground">{d.class_label} · {d.term} · {d.academic_year}</p>
                          </div>
                          <Badge variant={d.status === "active" ? "default" : d.status === "draft" ? "secondary" : "outline"}>{d.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {d.type === "class" ? `${slots.length} cells · ${teachers.size} teachers` : `Updated ${new Date(d.updated_at).toLocaleDateString()}`}
                        </div>
                        <div className="flex gap-1 pt-1 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => { setActiveId(d.id); setView("builder"); }}><Pencil className="h-3 w-3 mr-1" />Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => printDef(d)}><Printer className="h-3 w-3 mr-1" />Print</Button>
                          <Button size="sm" variant="ghost" onClick={() => duplicate(d)}><Copy className="h-3 w-3 mr-1" />Duplicate</Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(d)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}

      {view === "builder" && activeDef && (
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Back to list</Button>
              <h2 className="text-xl font-semibold">{activeDef.name}</h2>
              <p className="text-xs text-muted-foreground">{activeDef.class_label} · {activeDef.term} · {activeDef.academic_year}</p>
            </div>
            <Badge variant={activeDef.status === "active" ? "default" : "secondary"}>{activeDef.status}</Badge>
          </div>

          {activeDef.type === "class" ? (
            <TimetableGridBuilder
              definitionId={activeDef.id}
              defName={activeDef.name}
              schoolDays={activeDef.school_days}
              dayStart={activeDef.day_start_time}
              periodMinutes={activeDef.period_minutes}
              periodsPerDay={activeDef.periods_per_day}
              breaks={activeDef.breaks ?? []}
              slots={activeSlots}
              onSave={saveSlots}
              onPublish={publish}
              onAIRegenerate={(fb) => runAIGeneration(activeDef, { ...(activeDef.settings ?? {}), freeText: fb }, fb)}
            />
          ) : (
            <ExamTimetableBuilder
              definitionId={activeDef.id}
              startDate={activeDef.start_date ?? ""}
              endDate={activeDef.end_date ?? ""}
              initialSlots={activeExamSlots}
              onSaved={loadAll}
              aiMode={!!activeDef.settings?.aiMode || aiMode}
            />
          )}
        </div>
      )}

      {view === "views" && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Back to list</Button>
          <TimetableViewModes
            defs={defs.filter(d => d.type === "class")}
            allSlots={allSlots}
            mode={viewMode} setMode={setViewMode}
            filter={viewFilter} setFilter={setViewFilter}
          />
          <SubstitutionFinder allSlots={allSlots} />
        </div>
      )}

      {view === "analytics" && (
        <div className="space-y-3">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>← Back to list</Button>
          <TimetableAnalytics allSlots={allSlots} />
        </div>
      )}

      <TimetableSetupDialog open={setupOpen} aiMode={aiMode} onOpenChange={setSetupOpen} onSubmit={createTimetable} />
    </div>
  );
}
