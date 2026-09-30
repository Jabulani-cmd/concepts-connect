import { useState } from "react";
import { CalendarRange, Loader2, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import { openPrintWindow } from "@/lib/finance/print";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { callTeacherAi, ZIM_LEVELS, ZIM_SUBJECTS } from "@/lib/teacherAi";
import { addRow, removeRow, useDemoRows } from "@/lib/teacherAiStore";
import { safeHtml } from "@/lib/utils";

interface Week {
  week: number;
  topic: string;
  objectives: string[];
  content: string;
  activities: string;
  resources: string;
  assessment: string;
}
interface Scheme { title: string; aims: string[]; weeks: Week[] }
type Saved = Scheme & { subject: string; level: string; term: string };

const TERMS = ["Term 1", "Term 2", "Term 3"];

function printScheme(s: Saved) {
  const rows = s.weeks.map((w) =>
    `<tr><td>${w.week}</td><td><strong>${safeHtml(w.topic)}</strong><br/>${safeHtml(w.content)}</td><td>${(w.objectives || []).map((o) => `• ${safeHtml(o)}`).join("<br/>")}</td><td>${safeHtml(w.activities)}</td><td>${safeHtml(w.resources)}</td><td>${safeHtml(w.assessment)}</td><td style="width:70px"></td></tr>`,
  ).join("");
  openPrintWindow(buildBrandedHtml({
    title: s.title || `Scheme of Work: ${s.subject}`,
    subtitle: `${s.subject} · ${s.level} · ${s.term}`,
    bodyHtml:
      (s.aims?.length ? `<p><strong>Aims:</strong> ${s.aims.map(safeHtml).join("; ")}</p>` : "") +
      `<table><thead><tr><th>Week</th><th>Topic and content</th><th>Objectives</th><th>Methods / activities</th><th>Resources</th><th>Assessment</th><th>Evaluation</th></tr></thead><tbody>${rows}</tbody></table>`,
  }));
}

/** A full termly scheme of work (week by week, ZIMSEC), ready to edit, save and hand to the HOD. */
export default function SchemeOfWorkGenerator() {
  const { toast } = useToast();
  const saved = useDemoRows<Saved>("schemes_of_work");
  const [subject, setSubject] = useState("Mathematics");
  const [level, setLevel] = useState("Form 3");
  const [term, setTerm] = useState("Term 1");
  const [weeks, setWeeks] = useState("13");
  const [periods, setPeriods] = useState("6");
  const [topics, setTopics] = useState("");
  const [loading, setLoading] = useState(false);
  const [scheme, setScheme] = useState<Scheme | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const out = await callTeacherAi<Scheme>("scheme_of_work", { subject, level, term, weeks, periods, topics });
      setScheme({ title: out.title || `${subject} ${level} ${term} Scheme of Work`, aims: out.aims ?? [], weeks: (out.weeks ?? []).map((w, i) => ({ ...w, week: w.week || i + 1, objectives: w.objectives ?? [] })) });
      toast({ title: "Scheme of work ready", description: "Check and edit each week before saving." });
    } catch (e) {
      toast({ title: "Could not generate the scheme", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const edit = (i: number, patch: Partial<Week>) => setScheme((s) => (s ? { ...s, weeks: s.weeks.map((w, j) => (j === i ? { ...w, ...patch } : w)) } : s));

  const save = () => {
    if (!scheme) return;
    addRow("schemes_of_work", { ...scheme, subject, level, term });
    toast({ title: "Scheme of work saved" });
    setScheme(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" /> Scheme of Work Generator <Badge variant="secondary">ZIMSEC</Badge>
          </CardTitle>
          <CardDescription>A whole term planned week by week: topics, objectives, methods, resources and assessment, in the layout HODs expect. Print it ready to sign.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1">
              <Label>Subject</Label>
              <Select value={subject} onValueChange={setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZIM_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Form level</Label>
              <Select value={level} onValueChange={setLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ZIM_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TERMS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Weeks</Label><Input type="number" min={4} max={16} value={weeks} onChange={(e) => setWeeks(e.target.value)} /></div>
            <div className="space-y-1"><Label>Periods a week</Label><Input type="number" min={1} max={12} value={periods} onChange={(e) => setPeriods(e.target.value)} /></div>
          </div>
          <div className="space-y-1">
            <Label>Topics to cover (optional)</Label>
            <Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Leave empty to follow the ZIMSEC syllabus for this term" />
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Generate scheme of work
          </Button>

          {scheme && (
            <div className="space-y-3 rounded-md border p-3">
              <div className="space-y-1"><Label>Title</Label><Input value={scheme.title} onChange={(e) => setScheme({ ...scheme, title: e.target.value })} /></div>
              <div className="space-y-2">
                {scheme.weeks.map((w, i) => (
                  <div key={i} className="grid gap-2 rounded-md bg-muted/30 p-2 md:grid-cols-[60px_1fr_1fr]">
                    <p className="text-sm font-semibold text-primary">Week {w.week}</p>
                    <div className="space-y-1">
                      <Input value={w.topic} onChange={(e) => edit(i, { topic: e.target.value })} className="h-8 font-medium" />
                      <Textarea value={w.content} onChange={(e) => edit(i, { content: e.target.value })} className="min-h-[56px] text-xs" />
                      <Textarea value={(w.objectives || []).join("\n")} onChange={(e) => edit(i, { objectives: e.target.value.split("\n") })} className="min-h-[56px] text-xs" placeholder="Objectives, one per line" />
                    </div>
                    <div className="space-y-1">
                      <Textarea value={w.activities} onChange={(e) => edit(i, { activities: e.target.value })} className="min-h-[56px] text-xs" placeholder="Methods and activities" />
                      <Input value={w.resources} onChange={(e) => edit(i, { resources: e.target.value })} className="h-8 text-xs" placeholder="Resources" />
                      <Input value={w.assessment} onChange={(e) => edit(i, { assessment: e.target.value })} className="h-8 text-xs" placeholder="Assessment" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save scheme</Button>
                <Button variant="outline" onClick={() => printScheme({ ...scheme, subject, level, term })}><Printer className="mr-2 h-4 w-4" /> Print</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {saved.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Saved schemes of work ({saved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {saved.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.subject} · {row.level} · {row.term} · {row.weeks.length} weeks</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => printScheme(row)} aria-label="Print"><Printer className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeRow("schemes_of_work", row.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
