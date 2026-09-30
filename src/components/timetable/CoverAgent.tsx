import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Printer, UserMinus, Users, Wand2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { planCover, rankCover, type CoverLesson } from "@/lib/timetable/cover";
import { cancelCover, loadCoverDay, saveCover, weekdayOf, type AwayTeacher, type CoverDay } from "@/lib/timetable/coverData";

const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Today, or the next Monday at the weekend. */
function nextSchoolDay() {
  const d = new Date();
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return localDate(d);
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/**
 * Cover Agent: finds every lesson whose teacher is away on a day (approved leave or
 * marked away here) and suggests a free substitute for each, fairly shared out.
 */
export default function CoverAgent() {
  const { toast } = useToast();
  const [date, setDate] = useState(nextSchoolDay);
  const [day, setDay] = useState<CoverDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [manual, setManual] = useState<AwayTeacher[]>([]);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = async (d = date) => {
    setLoading(true);
    try {
      setDay(await loadCoverDay(d));
    } catch (e) {
      toast({ title: "Could not load the timetable", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
    setManual([]);
    setChoice({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // Live updates when someone else assigns cover.
  useEffect(() => {
    const ch = supabase.channel(`cover-${date}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timetable_cover" }, () => load(date))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const staffName = useMemo(() => new Map(day?.staff.map((s) => [s.id, s.name])), [day]);
  const away = useMemo(() => [...(day?.onLeave ?? []), ...manual.filter((m) => !day?.onLeave.some((l) => l.staffId === m.staffId))], [day, manual]);
  const awayIds = useMemo(() => new Set(away.map((a) => a.staffId)), [away]);

  const { needCover, plan, alreadyCovered } = useMemo(() => {
    if (!day) return { needCover: [] as CoverLesson[], plan: [], alreadyCovered: new Set<string>() };
    const covered = new Set(day.assigned.map((a) => `${a.classId}|${a.startTime}`));
    const need = day.lessons.filter((l) => l.teacherId && awayIds.has(l.teacherId) && !covered.has(l.key));
    const ctx = {
      ...day.context,
      dayLessons: day.lessons,
      away: awayIds,
      assigned: day.assigned.filter((a) => a.coverStaffId).map((a) => ({ staffId: a.coverStaffId!, start: a.startTime, end: a.endTime })),
    };
    return { needCover: need, plan: planCover(need, ctx), alreadyCovered: covered, ctx };
  }, [day, awayIds]);

  const ctxFor = () => ({
    ...day!.context,
    dayLessons: day!.lessons,
    away: awayIds,
    assigned: day!.assigned.filter((a) => a.coverStaffId).map((a) => ({ staffId: a.coverStaffId!, start: a.startTime, end: a.endTime })),
  });

  const reasonFor = (teacherId: string | null) => away.find((a) => a.staffId === teacherId)?.reason ?? "away";

  const assign = async (items: { lesson: CoverLesson; staffId: string }[]) => {
    if (!day || !items.length) return;
    setSaving(true);
    try {
      await saveCover(items.map((i) => ({ date, lesson: i.lesson, coverStaffId: i.staffId, reason: reasonFor(i.lesson.teacherId) })));
      toast({ title: items.length === 1 ? "Cover assigned" : `${items.length} lessons covered`, description: "The substitute teachers can see this in their portal." });
      setChoice({});
      await load(date);
    } catch (e) {
      const msg = errorMessage(e);
      toast({
        title: "Could not save the cover",
        description: /timetable_cover|schema cache|does not exist/i.test(msg) ? "The cover table is not set up yet. Run the new SQL file in the database first." : msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const assignAll = () =>
    assign(plan.flatMap((p) => {
      const id = choice[p.lesson.key] ?? p.suggestion?.staffId;
      return id ? [{ lesson: p.lesson, staffId: id }] : [];
    }));

  const cancel = async (id: string) => {
    try {
      await cancelCover(id);
      await load(date);
    } catch (e) {
      toast({ title: "Could not cancel", description: errorMessage(e), variant: "destructive" });
    }
  };

  const print = () => {
    if (!day) return;
    const rows = day.assigned
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((a) => {
        const lesson = day.lessons.find((l) => l.key === `${a.classId}|${a.startTime}`);
        return `<tr><td>${a.startTime}–${a.endTime}</td><td>${esc(lesson?.className ?? "")}</td><td>${esc(lesson?.subjectName ?? "")}</td><td>${esc(a.room ?? lesson?.room ?? "")}</td><td>${esc(staffName.get(a.absentStaffId ?? "") ?? "")}</td><td><strong>${esc(staffName.get(a.coverStaffId ?? "") ?? "")}</strong></td></tr>`;
      })
      .join("");
    const html = buildBrandedHtml({
      title: "Cover Sheet",
      subtitle: new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      bodyHtml: rows
        ? `<table><thead><tr><th>Time</th><th>Class</th><th>Subject</th><th>Room</th><th>Away</th><th>Covered by</th></tr></thead><tbody>${rows}</tbody></table>`
        : "<p>No cover has been assigned for this day.</p>",
    });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  const weekend = weekdayOf(date) > 5;
  const teachingToday = (id: string) => day?.lessons.filter((l) => l.teacherId === id).length ?? 0;

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Cover Agent (substitute teachers)</CardTitle>
        <CardDescription className="max-w-3xl">
          Teachers on approved leave are picked up automatically; mark anyone else who is away today. The agent finds every lesson they would have taught and suggests
          a free teacher for each: someone who teaches the subject or the class first, then whoever has the lightest day and has done the least cover this week.
          Nobody is suggested for two lessons at once.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="cover-date">Day</Label>
            <Input id="cover-date" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
          </div>
          <Button variant="outline" onClick={print} disabled={!day?.assigned.length}><Printer className="mr-1.5 h-4 w-4" /> Print cover sheet</Button>
        </div>

        {loading || !day ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading the day's timetable…</p>
        ) : weekend ? (
          <p className="text-sm text-muted-foreground">That is a weekend. Choose a school day.</p>
        ) : day.lessons.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">There is no published timetable for this day yet. Build and publish one with the Timetable Agent first.</p>
        ) : (
          <>
            {!day.canSave && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                Suggestions work, but cover can't be saved until the new SQL file (timetable cover) has been run in the database.
              </p>
            )}

            <section className="space-y-2">
              <Label className="flex items-center gap-1.5"><UserMinus className="h-4 w-4" /> Teachers away</Label>
              <div className="flex flex-wrap gap-2">
                {away.length === 0 && <span className="text-sm text-muted-foreground">No one is away. Everyone on approved leave appears here automatically.</span>}
                {away.map((a) => (
                  <Badge key={a.staffId} variant={a.source === "leave" ? "secondary" : "outline"} className="gap-1.5 py-1 pl-2.5">
                    {staffName.get(a.staffId) ?? "Teacher"} <span className="font-normal text-muted-foreground">({a.reason})</span>
                    {a.source === "manual" && (
                      <button type="button" aria-label="Not away" onClick={() => setManual((m) => m.filter((x) => x.staffId !== a.staffId))}><X className="h-3.5 w-3.5" /></button>
                    )}
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value="" onValueChange={(id) => setManual((m) => [...m, { staffId: id, reason: "away today", source: "manual" }])}>
                  <SelectTrigger className="w-72"><SelectValue placeholder="Mark a teacher away…" /></SelectTrigger>
                  <SelectContent>
                    {day.staff.filter((s) => !awayIds.has(s.id) && teachingToday(s.id) > 0).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({teachingToday(s.id)} lessons)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {needCover.length > 0 && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>{needCover.length} lesson{needCover.length === 1 ? " needs" : "s need"} cover</Label>
                  <Button onClick={assignAll} disabled={saving || !day.canSave || plan.every((p) => !p.suggestion && !choice[p.lesson.key])}>
                    {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1.5 h-4 w-4" />} Assign all suggestions
                  </Button>
                </div>
                <div className="space-y-2">
                  {plan.map((p) => {
                    const picked = choice[p.lesson.key] ?? p.suggestion?.staffId ?? "";
                    const options = [p.suggestion, ...p.alternatives].filter(Boolean) as NonNullable<typeof p.suggestion>[];
                    // Anyone else free at that time, in case the admin wants a different person.
                    const more = rankCover(p.lesson, ctxFor()).filter((c) => !options.some((o) => o.staffId === c.staffId));
                    const pickedInfo = [...options, ...more].find((c) => c.staffId === picked);
                    return (
                      <div key={p.lesson.key} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{p.lesson.start}–{p.lesson.end} · {p.lesson.className} · {p.lesson.subjectName}</p>
                          <p className="text-xs text-muted-foreground">{staffName.get(p.lesson.teacherId ?? "")} is {reasonFor(p.lesson.teacherId)}{p.lesson.room ? ` · ${p.lesson.room}` : ""}</p>
                          {pickedInfo && <p className="mt-0.5 text-xs text-primary">Why: {pickedInfo.reasons.join(", ")}</p>}
                          {!p.suggestion && !more.length && <p className="mt-0.5 text-xs text-destructive">No teacher is free at this time. Consider supervised study or combining classes.</p>}
                        </div>
                        <div className="flex gap-2">
                          <Select value={picked} onValueChange={(v) => setChoice((c) => ({ ...c, [p.lesson.key]: v }))}>
                            <SelectTrigger className="w-60"><SelectValue placeholder="Choose a teacher" /></SelectTrigger>
                            <SelectContent>
                              {[...options, ...more].map((c, i) => (
                                <SelectItem key={c.staffId} value={c.staffId}>{i === 0 && c.staffId === p.suggestion?.staffId ? "★ " : ""}{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" disabled={!picked || saving || !day.canSave} onClick={() => assign([{ lesson: p.lesson, staffId: picked }])}>Assign</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {away.length > 0 && needCover.length === 0 && (
              <p className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"><CheckCircle2 className="h-4 w-4" /> Every lesson of the teachers away is covered.</p>
            )}

            {day.assigned.length > 0 && (
              <section className="space-y-2">
                <Label>Cover assigned for this day ({day.assigned.length})</Label>
                <div className="divide-y rounded-lg border">
                  {[...day.assigned].sort((a, b) => a.startTime.localeCompare(b.startTime)).map((a) => {
                    const lesson = day.lessons.find((l) => l.key === `${a.classId}|${a.startTime}`);
                    return (
                      <div key={a.id} className="flex items-center gap-3 p-2.5 text-sm">
                        <span className="w-24 shrink-0 text-muted-foreground">{a.startTime}–{a.endTime}</span>
                        <span className="min-w-0 flex-1">
                          {lesson?.className ?? "Class"} · {lesson?.subjectName ?? "Lesson"}: <strong>{staffName.get(a.coverStaffId ?? "") ?? "?"}</strong>
                          <span className="text-muted-foreground"> for {staffName.get(a.absentStaffId ?? "") ?? "?"}</span>
                        </span>
                        <Button size="sm" variant="ghost" onClick={() => cancel(a.id)} aria-label="Cancel cover"><X className="h-4 w-4" /></Button>
                      </div>
                    );
                  })}
                </div>
                {alreadyCovered.size > 0 && <p className="text-xs text-muted-foreground">Substitutes see their cover lessons in the teacher portal.</p>}
              </section>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
