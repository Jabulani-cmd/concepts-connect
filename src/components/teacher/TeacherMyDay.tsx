import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Bot, CheckCircle2, ClipboardCheck, Clock, PenLine, Sparkles, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Lesson = { start: string; end: string; className: string; subject: string; room: string | null };
type Todo = { key: string; icon: typeof Bot; text: string; action: string; tab: string; tone: "warn" | "info" };

const hhmm = (t: string | null) => (t ?? "").slice(0, 5);
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * The teacher's day, prepared by the school agent: today's lessons, and a short to-do
 * list (registers, marking, learners to support) with one click to the right tool.
 */
export default function TeacherMyDay({ staffId, userId, onOpen }: { staffId?: string | null; userId?: string | null; onOpen: (tab: string) => void }) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const navigate = useNavigate();
  const open = (tab: string) => (tab.startsWith("/") ? navigate(tab) : onOpen(tab));

  useEffect(() => {
    if (!staffId) return;
    const load = async () => {
      const js = new Date().getDay();
      const weekday = js === 0 ? 7 : js;
      const [entries, myClasses, findings] = await Promise.all([
        supabase.from("timetable_entries").select("day_of_week, start_time, end_time, room, classes(name), subjects(name)").eq("teacher_id", staffId),
        supabase.from("classes").select("id, name").eq("class_teacher_id", staffId),
        userId
          ? supabase.from("agent_findings").select("kind").eq("assigned_to", userId).in("status", ["open", "acknowledged"])
          : Promise.resolve({ data: [] as { kind: string }[] }),
      ]);
      const all = entries.data ?? [];
      const zeroBased = all.some((e) => e.day_of_week === 0);
      setLessons(
        all.filter((e) => (zeroBased ? e.day_of_week + 1 : e.day_of_week) === weekday)
          .map((e) => ({
            start: hhmm(e.start_time), end: hhmm(e.end_time), room: e.room,
            className: (e.classes as { name: string } | null)?.name ?? "Class",
            subject: (e.subjects as { name: string } | null)?.name ?? "Lesson",
          }))
          .sort((a, b) => a.start.localeCompare(b.start)),
      );

      const list: Todo[] = [];
      const classes = myClasses.data ?? [];
      if (classes.length && weekday <= 5) {
        const { data: taken } = await supabase.from("attendance").select("class_id").eq("date", localDate()).in("class_id", classes.map((c) => c.id));
        const done = new Set((taken ?? []).map((t) => t.class_id));
        for (const c of classes.filter((c) => !done.has(c.id))) {
          list.push({ key: `reg-${c.id}`, icon: ClipboardCheck, text: `Take today's register for ${c.name}. Parents of absent learners are told automatically.`, action: "Take register", tab: "attendance", tone: "warn" });
        }
      }
      const count = (k: string) => (findings.data ?? []).filter((f) => f.kind === k).length;
      if (count("marks_overdue")) list.push({ key: "marks", icon: PenLine, text: `${count("marks_overdue")} piece${count("marks_overdue") === 1 ? "" : "s"} of work still to mark. The AI Shadow Marker can mark submissions and draft feedback for you to approve.`, action: "Mark with AI", tab: "/portal/teacher/ai-marker", tone: "warn" });
      const support = count("at_risk") + count("low_performance");
      if (support) list.push({ key: "support", icon: TrendingDown, text: `${support} learner${support === 1 ? "" : "s"} in your classes need${support === 1 ? "s" : ""} support. The agent has explained why and suggested next steps.`, action: "Review", tab: "ai-assist", tone: "info" });
      list.push({ key: "plan", icon: Sparkles, text: "Let AI prepare tomorrow's lesson plans, worksheets or this term's scheme of work.", action: "Open AI tools", tab: "ai-assist", tone: "info" });
      setTodos(list);
      setLoaded(true);
    };
    load();
  }, [staffId, userId]);

  if (!staffId || !loaded) return null;
  const now = new Date().toTimeString().slice(0, 5);
  const next = lessons.find((l) => l.end > now);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 font-heading text-lg"><Bot className="h-5 w-5 text-primary" /> My day</CardTitle>
        <CardDescription>
          {lessons.length ? `${lessons.length} lesson${lessons.length === 1 ? "" : "s"} today` : "No timetabled lessons today"}
          {next ? ` · next: ${next.start} ${next.className} ${next.subject}${next.room ? ` (${next.room})` : ""}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lessons.length > 0 && (
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {lessons.map((l, i) => (
              <div key={i} className={cn("shrink-0 rounded-lg border bg-card px-3 py-2 text-xs", next === l && "border-primary ring-1 ring-primary")}>
                <p className="flex items-center gap-1 font-semibold"><Clock className="h-3 w-3" /> {l.start}–{l.end}</p>
                <p>{l.className} · {l.subject}</p>
                {l.room && <p className="text-muted-foreground">{l.room}</p>}
              </div>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {todos.map((t) => (
            <div key={t.key} className={cn("flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center", t.tone === "warn" ? "border-amber-300 bg-amber-50/70 dark:bg-amber-950/20" : "bg-card")}>
              <t.icon className={cn("hidden h-5 w-5 shrink-0 sm:block", t.tone === "warn" ? "text-amber-600" : "text-primary")} />
              <p className="flex-1 text-sm">{t.text}</p>
              <Button size="sm" variant={t.tone === "warn" ? "default" : "outline"} onClick={() => open(t.tab)}>{t.action}</Button>
            </div>
          ))}
          {todos.length === 1 && (
            <p className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400"><CheckCircle2 className="h-3.5 w-3.5" /> Registers and marking are up to date.</p>
          )}
          {todos.some((t) => t.key === "support") && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Nothing is sent to families from these items without a person reviewing them, except automatic absence and progress alerts.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
