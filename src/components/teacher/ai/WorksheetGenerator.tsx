import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Eye, Loader2, Printer, Save, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi, ZIM_LEVELS, ZIM_SUBJECTS } from "@/lib/teacherAi";
import { addRow, removeRow, useDemoRows } from "@/lib/teacherAiStore";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { openPrintWindow, openViewWindow } from "@/lib/finance/print";

interface Question {
  number: number;
  question: string;
  options?: string[];
  answer: string;
  marks?: number;
}
interface Sheet {
  title: string;
  instructions: string;
  questions: Question[];
}

const FORMATS = [
  { value: "multiple choice", label: "Multiple choice" },
  { value: "short answer", label: "Short answer" },
  { value: "essay", label: "Essay" },
];

function esc(s: string) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
}

function sheetHtml(row: any, withAnswers: boolean) {
  const sheet: Sheet = row.content;
  const qs = (sheet.questions || [])
    .map((q) => {
      const opts = q.options?.length
        ? `<ul>${q.options.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>`
        : "";
      const ans = withAnswers ? `<p><strong>Answer:</strong> ${esc(q.answer)}</p>` : "";
      return `<div style="margin-bottom:14px"><p><strong>${q.number}.</strong> ${esc(q.question)} ${
        q.marks ? `<em>[${q.marks}]</em>` : ""
      }</p>${opts}${ans}</div>`;
    })
    .join("");
  return buildBrandedHtml({
    title: sheet.title || row.topic,
    subtitle: `${row.subject} · ${row.level} · ${row.format}${withAnswers ? " · ANSWER KEY" : ""}`,
    bodyHtml: `<p>${esc(sheet.instructions || "")}</p>${qs}`,
  });
}

export default function WorksheetGenerator() {
  const { toast } = useToast();
  const saved = useDemoRows<any>("generated_materials");
  const [subject, setSubject] = useState("Mathematics");
  const [level, setLevel] = useState("Form 3");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("10");
  const [format, setFormat] = useState("multiple choice");
  const [difficulty, setDifficulty] = useState("medium");
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const generate = async () => {
    if (!topic.trim()) {
      toast({ title: "Enter a topic first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const result = await callTeacherAi<Sheet>("worksheet", { subject, level, topic, count, format, difficulty });
      setSheet(result);
      toast({ title: "Worksheet ready" });
    } catch (e: any) {
      toast({ title: "Could not generate worksheet", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!sheet) return;
    addRow("generated_materials", { subject, level, topic, format, difficulty, content: sheet });
    toast({ title: "Worksheet saved" });
    setSheet(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" /> Worksheet & Quiz Generator
            <Badge variant="secondary">With answer key</Badge>
          </CardTitle>
          <CardDescription>Pick the format and difficulty, then print or save the worksheet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              <Label>Question format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{FORMATS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Number of questions</Label>
              <Input type="number" min="1" max="30" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={setDifficulty}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Topic</Label>
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis" />
            </div>
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate worksheet
          </Button>

          {sheet && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="font-medium">{sheet.title}</p>
              <p className="text-sm text-muted-foreground">{sheet.instructions}</p>
              <div className="max-h-[320px] space-y-3 overflow-auto">
                {(sheet.questions || []).map((q) => (
                  <div key={q.number} className="text-sm">
                    <p className="font-medium">{q.number}. {q.question} {q.marks ? <span className="text-muted-foreground">[{q.marks}]</span> : null}</p>
                    {q.options?.length ? (
                      <ul className="ml-5 list-disc text-muted-foreground">{q.options.map((o, i) => <li key={i}>{o}</li>)}</ul>
                    ) : null}
                    <p className="text-xs text-primary">Answer: {q.answer}</p>
                  </div>
                ))}
              </div>
              <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save worksheet</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {saved.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Saved materials ({saved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {saved.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.content?.title || row.topic}</p>
                  <p className="text-xs text-muted-foreground">{row.subject} · {row.level} · {row.format} · {row.content?.questions?.length ?? 0} questions</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => openViewWindow(sheetHtml(row, false))}><Eye className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => openPrintWindow(sheetHtml(row, true))}><Printer className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeRow("generated_materials", row.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
