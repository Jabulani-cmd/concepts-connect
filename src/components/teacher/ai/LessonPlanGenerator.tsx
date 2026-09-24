import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Loader2, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi, ZIM_LEVELS, ZIM_SUBJECTS } from "@/lib/teacherAi";
import { addRow, removeRow, useDemoRows } from "@/lib/teacherAiStore";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { openPrintWindow } from "@/lib/finance/print";
import { errorMessage } from "@/lib/errors";
import { safeHtml } from "@/lib/utils";

interface Plan {
  title: string;
  objectives: string[];
  outline: { stage: string; minutes: number; activity: string }[];
  materials: string[];
  assessment: string;
  homework: string;
}

function planToText(p: Plan): string {
  return [
    `TITLE: ${p.title}`,
    "",
    "LEARNING OBJECTIVES:",
    ...(p.objectives || []).map((o) => `- ${o}`),
    "",
    "LESSON OUTLINE:",
    ...(p.outline || []).map((s) => `- ${s.stage} (${s.minutes} min): ${s.activity}`),
    "",
    `MATERIALS: ${(p.materials || []).join(", ")}`,
    "",
    `ASSESSMENT IDEA: ${p.assessment}`,
    "",
    `HOMEWORK: ${p.homework}`,
  ].join("\n");
}

type SavedPlan = { title: string; subject: string; level: string; class_name: string; topic: string; duration: string | number; content: string };

export default function LessonPlanGenerator() {
  const { toast } = useToast();
  const saved = useDemoRows<SavedPlan>("lesson_plans");
  const [subject, setSubject] = useState("Mathematics");
  const [level, setLevel] = useState("Form 3");
  const [topic, setTopic] = useState("");
  const [className, setClassName] = useState("");
  const [duration, setDuration] = useState("40");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");

  const generate = async () => {
    if (!topic.trim()) {
      toast({ title: "Enter a topic first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const plan = await callTeacherAi<Plan>("lesson_plan", { subject, level, topic, duration });
      setTitle(plan.title || `${subject}: ${topic}`);
      setDraft(planToText(plan));
      toast({ title: "Lesson plan ready", description: "Edit anything before you save it." });
    } catch (e) {
      toast({ title: "Could not generate plan", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!draft.trim()) return;
    addRow("lesson_plans", { title, subject, level, class_name: className, topic, duration, content: draft });
    toast({ title: "Lesson plan saved" });
    setDraft("");
    setTitle("");
  };

  const print = (row: SavedPlan) => {
    openPrintWindow(
      buildBrandedHtml({
        title: row.title,
        subtitle: `${row.subject} · ${row.level}${row.class_name ? ` · ${row.class_name}` : ""} · ${row.duration} minutes`,
        bodyHtml: `<pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px">${safeHtml(row.content)}</pre>`,
      }),
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Lesson Plan Generator
            <Badge variant="secondary">ZIMSEC aligned</Badge>
          </CardTitle>
          <CardDescription>Objectives, a full lesson outline and an assessment idea, editable before saving.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
              <Label>Class (optional)</Label>
              <Input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. 3 Blue" />
            </div>
            <div className="space-y-1">
              <Label>Duration (minutes)</Label>
              <Input type="number" min="10" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Topic</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Simultaneous equations" />
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate lesson plan
          </Button>

          {draft && (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              <Label>Plan (edit freely)</Label>
              <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} className="min-h-[320px] font-mono text-xs" />
              <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save lesson plan</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {saved.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Saved lesson plans ({saved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {saved.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted-foreground">{row.subject} · {row.level} · {row.duration} min</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => print(row)}><Printer className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeRow("lesson_plans", row.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
