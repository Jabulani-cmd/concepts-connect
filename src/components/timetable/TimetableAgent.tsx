import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ChevronDown, Loader2, Plus, Rocket, Settings2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { colorForSubject, dayShort } from "@/lib/timetableUtils";
import { findClashes, solveTimetable, type Clash, type SolverResult } from "@/lib/timetable/solver";
import {
  buildSolverInput, defaultPeriods, loadPlan, loadSchool, periodsFor, publishTimetable, savePlan, schedule,
  type SchoolData, type TimetablePlan,
} from "@/lib/timetable/schoolData";

const ALL_DAYS = [1, 2, 3, 4, 5, 6];

/**
 * Timetable Agent: builds the whole school's timetable from the subjects and
 * teachers allocated to each class, checks it for clashes, and publishes it.
 */
export default function TimetableAgent() {
  const { toast } = useToast();
  const [school, setSchool] = useState<SchoolData | null>(null);
  const [plan, setPlan] = useState<TimetablePlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"solve" | "publish" | null>(null);
  const [result, setResult] = useState<(SolverResult & { clashes: Clash[] }) | null>(null);
  const [view, setView] = useState<string>("");
  const [setupOpen, setSetupOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [s, p] = await Promise.all([loadSchool(), loadPlan()]);
      setSchool(s);
      setPlan(p);
      if (!view && s.classes[0]) setView(`class:${s.classes[0].id}`);
    } catch (e) {
      toast({ title: "Could not load the school's records", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const names = useMemo(() => ({
    cls: new Map(school?.classes.map((c) => [c.id, c.name])),
    sub: new Map(school?.subjects.map((s) => [s.id, s.name])),
    tch: new Map(school?.teachers.map((t) => [t.id, t.name])),
  }), [school]);

  const summary = useMemo(() => {
    if (!school || !plan) return null;
    const input = buildSolverInput(school, plan);
    const classesWithLessons = new Set(input.lessons.map((l) => l.classId));
    const load = new Map<string, number>();
    for (const l of input.lessons) if (l.teacherId) load.set(l.teacherId, (load.get(l.teacherId) ?? 0) + l.periodsPerWeek);
    return {
      input,
      lessons: input.lessons.reduce((s, l) => s + l.periodsPerWeek, 0),
      classes: classesWithLessons.size,
      emptyClasses: school.classes.filter((c) => !classesWithLessons.has(c.id)),
      noTeacher: input.lessons.filter((l) => !l.teacherId),
      teachers: load.size,
      slots: plan.days.length * plan.periodsPerDay,
    };
  }, [school, plan]);

  const update = (patch: Partial<TimetablePlan>) => {
    setPlan((p) => (p ? { ...p, ...patch } : p));
    setResult(null);
  };

  const generate = async () => {
    if (!school || !plan || !summary) return;
    setBusy("solve");
    setResult(null);
    // Let the button show its spinner before the work starts.
    await new Promise((r) => setTimeout(r, 30));
    try {
      await savePlan(plan).catch(() => undefined);
      const out = solveTimetable(summary.input);
      const clashes = findClashes(summary.input, out.placements);
      setResult({ ...out, clashes });
      const missing = out.unplaced.reduce((s, u) => s + u.missing, 0);
      toast({
        title: missing ? `Timetable built with ${missing} lesson${missing === 1 ? "" : "s"} unplaced` : "Timetable built with no clashes",
        description: missing ? "See the list below for what is stopping them." : `${out.placements.length} lessons placed and checked.`,
        variant: missing ? "destructive" : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    if (!school || !plan || !result) return;
    const missing = result.unplaced.reduce((s, u) => s + u.missing, 0);
    if (result.clashes.length) return;
    if (!window.confirm(
      `${missing ? `${missing} lessons could not be placed and will be left out. ` : ""}Publish this timetable for ${summary?.classes} classes? It replaces each class's current timetable in the student, parent and teacher portals.`,
    )) return;
    setBusy("publish");
    try {
      const n = await publishTimetable(school, plan, result.placements);
      toast({ title: "Timetable published", description: `${n} lessons are now live in every portal.` });
    } catch (e) {
      toast({ title: "Could not publish", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (loading || !school || !plan || !summary) {
    return (
      <Card><CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading the school's classes, subjects and teachers…</CardContent></Card>
    );
  }

  const times = schedule(plan);
  const teaching = times.filter((t) => !t.isBreak);
  const missing = result?.unplaced.reduce((s, u) => s + u.missing, 0) ?? 0;
  const subjectsInUse = school.subjects.filter((s) => school.allocations.some((a) => a.subjectId === s.id));
  const [viewKind, viewId] = view.split(":");
  const shown = result?.placements.filter((p) => (viewKind === "class" ? p.classId === viewId : p.teacherId === viewId)) ?? [];

  const problemText = (kind: string, ids: string[], message: string) => {
    if (kind === "teacher_overloaded") return `${names.tch.get(ids[0]) ?? "A teacher"} ${message}.`;
    if (kind === "class_overfull") return `${names.cls.get(ids[0]) ?? "A class"} ${message}.`;
    if (kind === "no_teacher") {
      const [c, s] = ids[0].split(":");
      return `${names.cls.get(c) ?? "A class"}: ${names.sub.get(s) ?? "a subject"} has no teacher allocated.`;
    }
    return message;
  };

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-heading flex items-center gap-2"><Bot className="h-5 w-5 text-primary" /> Timetable Agent</CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Builds the whole school's timetable at once from the subjects and teachers allocated to each class (Academics → teacher allocation). No teacher, class
              or specialist room is ever booked twice, each subject gets its periods spread across the week, and the result is checked again for clashes before you publish.
            </CardDescription>
          </div>
          <Button onClick={generate} disabled={!!busy || summary.lessons === 0} className="shrink-0">
            {busy === "solve" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />} Build timetable
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Classes", summary.classes],
            ["Teachers", summary.teachers],
            ["Lessons a week", summary.lessons],
            ["Periods a week", `${summary.slots} per class`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-muted/30 p-3">
              <p className="text-lg font-bold">{v}</p>
              <p className="text-xs text-muted-foreground">{k}</p>
            </div>
          ))}
        </div>

        {(summary.emptyClasses.length > 0 || summary.noTeacher.length > 0) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="h-4 w-4" /> Before building</p>
            {summary.emptyClasses.length > 0 && (
              <p className="mt-1">No subjects allocated yet: {summary.emptyClasses.slice(0, 8).map((c) => c.name).join(", ")}{summary.emptyClasses.length > 8 ? "…" : ""}. These classes will be left out.</p>
            )}
            {summary.noTeacher.length > 0 && (
              <p className="mt-1">{summary.noTeacher.length} subject allocation{summary.noTeacher.length === 1 ? " has" : "s have"} no teacher. Allocate teachers in Academics first.</p>
            )}
          </div>
        )}

        <Collapsible open={setupOpen} onOpenChange={setSetupOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-2"><Settings2 className="h-4 w-4" /> School day, periods per subject, labs and days off</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", setupOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-6 pt-4">
            <section className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="space-y-1"><Label>Term</Label><Input value={plan.termLabel} onChange={(e) => update({ termLabel: e.target.value })} /></div>
              <div className="space-y-1"><Label>Year</Label><Input value={plan.academicYear} onChange={(e) => update({ academicYear: e.target.value })} /></div>
              <div className="space-y-1"><Label>Day starts</Label><Input type="time" value={plan.dayStart} onChange={(e) => update({ dayStart: e.target.value })} /></div>
              <div className="space-y-1"><Label>Minutes per period</Label><Input type="number" min={20} max={90} value={plan.periodMinutes} onChange={(e) => update({ periodMinutes: Number(e.target.value) || 40 })} /></div>
              <div className="space-y-1"><Label>Periods per day</Label><Input type="number" min={4} max={12} value={plan.periodsPerDay} onChange={(e) => update({ periodsPerDay: Math.min(12, Math.max(4, Number(e.target.value) || 8)) })} /></div>
              <div className="space-y-1">
                <Label>School days</Label>
                <div className="flex flex-wrap gap-1">
                  {ALL_DAYS.map((d) => (
                    <button key={d} type="button" onClick={() => update({ days: plan.days.includes(d) ? plan.days.filter((x) => x !== d) : [...plan.days, d].sort() })}
                      className={cn("rounded border px-2 py-1 text-xs", plan.days.includes(d) ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{dayShort(d)}</button>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Breaks</Label>
                <Button size="sm" variant="ghost" onClick={() => update({ breaks: [...plan.breaks, { afterPeriod: Math.min(plan.periodsPerDay - 1, 3), label: "Break", minutes: 15 }] })}><Plus className="mr-1 h-3.5 w-3.5" /> Add</Button>
              </div>
              {plan.breaks.map((b, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
                  <Input className="h-9 w-28" value={b.label} onChange={(e) => update({ breaks: plan.breaks.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <span>after period</span>
                  <Input className="h-9 w-16" type="number" min={1} max={plan.periodsPerDay - 1} value={b.afterPeriod + 1}
                    onChange={(e) => update({ breaks: plan.breaks.map((x, j) => (j === i ? { ...x, afterPeriod: Math.max(0, Number(e.target.value) - 1) } : x)) })} />
                  <Input className="h-9 w-16" type="number" min={5} value={b.minutes} onChange={(e) => update({ breaks: plan.breaks.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) || 15 } : x)) })} />
                  <span>minutes</span>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => update({ breaks: plan.breaks.filter((_, j) => j !== i) })} aria-label="Remove break"><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Periods: {teaching.map((t) => `${t.start}`).join(", ")}. The day ends at {times[times.length - 1]?.end}.</p>
            </section>

            <section className="space-y-2">
              <Label>Periods per week for each subject</Label>
              <p className="text-xs text-muted-foreground">Filled in with the usual ZIMSEC load; change any number. Tick "AM" to keep a subject in the morning where possible.</p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {subjectsInUse.map((s) => {
                  const example = school.allocations.find((a) => a.subjectId === s.id)!;
                  const value = plan.periods[s.id] ?? periodsFor(plan, school, example);
                  const am = plan.morningSubjectIds.includes(s.id);
                  return (
                    <div key={s.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <Input className="h-8 w-16" type="number" min={0} max={12} value={value}
                        onChange={(e) => update({ periods: { ...plan.periods, [s.id]: Math.max(0, Number(e.target.value) || 0) } })} />
                      <button type="button" onClick={() => update({ morningSubjectIds: am ? plan.morningSubjectIds.filter((x) => x !== s.id) : [...plan.morningSubjectIds, s.id] })}
                        className={cn("rounded border px-1.5 py-0.5 text-[11px]", am ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>AM</button>
                    </div>
                  );
                })}
              </div>
              {subjectsInUse.some((s) => plan.periods[s.id] === undefined && defaultPeriods(s.name, 1) !== defaultPeriods(s.name, 5)) && (
                <p className="text-xs text-muted-foreground">A-Level classes use A-Level loads unless you set a number here.</p>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Specialist rooms (labs)</Label>
                <Button size="sm" variant="ghost" onClick={() => update({ venues: [...plan.venues, { name: `Lab ${plan.venues.length + 1}`, subjectIds: [] }] })}><Plus className="mr-1 h-3.5 w-3.5" /> Add room</Button>
              </div>
              <p className="text-xs text-muted-foreground">Subjects ticked for a room are only taught there, and the room is never double-booked. With two science labs, add both and tick the science subjects in each.</p>
              {plan.venues.map((v, i) => (
                <div key={i} className="space-y-2 rounded border p-2">
                  <div className="flex items-center gap-2">
                    <Input className="h-9 max-w-xs" value={v.name} onChange={(e) => update({ venues: plan.venues.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => update({ venues: plan.venues.filter((_, j) => j !== i) })} aria-label="Remove room"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {subjectsInUse.map((s) => {
                      const on = v.subjectIds.includes(s.id);
                      return (
                        <button key={s.id} type="button"
                          onClick={() => update({ venues: plan.venues.map((x, j) => (j === i ? { ...x, subjectIds: on ? x.subjectIds.filter((y) => y !== s.id) : [...x.subjectIds, s.id] } : x)) })}
                          className={cn("rounded-full border px-2 py-0.5 text-xs", on ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>{s.name}</button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-2">
              <Label>Teachers' days off</Label>
              <p className="text-xs text-muted-foreground">For part-time staff or regular commitments. The agent never timetables a teacher on their day off.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(plan.daysOff).map(([id, days]) => (
                  <div key={id} className="flex items-center gap-2 rounded border p-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{names.tch.get(id) ?? "Teacher"}</span>
                    {plan.days.map((d) => (
                      <button key={d} type="button"
                        onClick={() => update({ daysOff: { ...plan.daysOff, [id]: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] } })}
                        className={cn("rounded border px-1.5 py-0.5 text-[11px]", days.includes(d) ? "border-destructive bg-destructive text-destructive-foreground" : "text-muted-foreground")}>{dayShort(d)}</button>
                    ))}
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { const next = { ...plan.daysOff }; delete next[id]; update({ daysOff: next }); }} aria-label="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                ))}
              </div>
              <Select value="" onValueChange={(id) => update({ daysOff: { ...plan.daysOff, [id]: [] } })}>
                <SelectTrigger className="max-w-xs"><SelectValue placeholder="Add a teacher…" /></SelectTrigger>
                <SelectContent>
                  {school.teachers.filter((t) => !(t.id in plan.daysOff) && school.allocations.some((a) => a.teacherId === t.id)).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </section>
          </CollapsibleContent>
        </Collapsible>

        {result && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {result.clashes.length === 0 ? (
                <Badge className="gap-1 bg-green-600 hover:bg-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Clash check passed: 0 clashes</Badge>
              ) : (
                <Badge variant="destructive">{result.clashes.length} clashes found</Badge>
              )}
              <Badge variant="outline">{result.placements.length} lessons placed</Badge>
              {missing > 0 && <Badge variant="destructive">{missing} not placed</Badge>}
              <div className="ml-auto">
                <Button onClick={publish} disabled={!!busy || result.clashes.length > 0 || result.placements.length === 0}>
                  {busy === "publish" ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Rocket className="mr-1.5 h-4 w-4" />} Publish to all portals
                </Button>
              </div>
            </div>

            {(missing > 0 || result.problems.length > 0) && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-semibold text-destructive">What is stopping a complete timetable</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {result.problems.map((p, i) => <li key={i}>{problemText(p.kind, p.ids, p.message)}</li>)}
                  {result.unplaced.slice(0, 12).map((u) => (
                    <li key={u.lessonId}>
                      {names.cls.get(u.classId)}: {names.sub.get(u.subjectId)} is short by {u.missing} period{u.missing === 1 ? "" : "s"}
                      {u.teacherId ? ` (${names.tch.get(u.teacherId)} has no free period that matches the class)` : ""}.
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">Fix by lowering periods for a subject, sharing a heavy teacher's classes with a colleague, adding a period per day, or adding another lab.</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Label className="text-sm">Show</Label>
              <Select value={view} onValueChange={setView}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {school.classes.filter((c) => result.placements.some((p) => p.classId === c.id)).map((c) => <SelectItem key={c.id} value={`class:${c.id}`}>Class: {c.name}</SelectItem>)}
                  {school.teachers.filter((t) => result.placements.some((p) => p.teacherId === t.id)).map((t) => <SelectItem key={t.id} value={`teacher:${t.id}`}>Teacher: {t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[640px] border-collapse text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="w-24 border-b p-2 text-left font-medium">Time</th>
                    {plan.days.map((d) => <th key={d} className="border-b p-2 text-left font-medium">{dayShort(d)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {times.map((t, i) => t.isBreak ? (
                    <tr key={`b${i}`} className="bg-muted/30"><td className="p-1.5 text-muted-foreground">{t.start}</td><td colSpan={plan.days.length} className="p-1.5 text-center italic text-muted-foreground">{t.label}</td></tr>
                  ) : (
                    <tr key={i} className="border-t">
                      <td className="p-1.5 align-top text-muted-foreground">{t.start}–{t.end}</td>
                      {plan.days.map((d) => {
                        const p = shown.find((x) => x.day === d && x.period === t.index);
                        const subject = p ? names.sub.get(p.subjectId) ?? "" : "";
                        return (
                          <td key={d} className="p-1 align-top">
                            {p ? (
                              <div className="rounded border-l-4 bg-card p-1.5 shadow-sm" style={{ borderLeftColor: colorForSubject(subject) }}>
                                <p className="font-medium leading-tight">{subject}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {viewKind === "class" ? names.tch.get(p.teacherId ?? "") ?? "No teacher" : names.cls.get(p.classId)}
                                  {p.venue ? ` · ${p.venue}` : ""}
                                </p>
                              </div>
                            ) : <span className="text-muted-foreground/50">Free</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!result && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" /> Check the settings above, then press Build timetable. Nothing changes in the portals until you publish.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
