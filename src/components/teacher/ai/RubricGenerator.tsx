import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Printer, Ruler, Save, Sparkles, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi, ZIM_LEVELS, ZIM_SUBJECTS } from "@/lib/teacherAi";
import { addRow, removeRow, useDemoRows } from "@/lib/teacherAiStore";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { openPrintWindow } from "@/lib/finance/print";
import { errorMessage } from "@/lib/errors";
import { safeHtml } from "@/lib/utils";

interface Band { band: string; range: string; descriptor: string }
interface Criterion { criterion: string; weight: number; bands: Band[] }
interface Rubric { title: string; total_marks: number; criteria: Criterion[] }

type SavedRubric = { subject: string; level: string; assignment: string; content: Rubric };

function rubricHtml(row: SavedRubric) {
  const r = row.content;
  const rows = (r.criteria || [])
    .map((c) =>
      (c.bands || [])
        .map(
          (b, i) =>
            `<tr>${i === 0 ? `<td rowspan="${c.bands.length}"><strong>${safeHtml(c.criterion)}</strong><br/><small>${safeHtml(c.weight)} marks</small></td>` : ""}<td>${safeHtml(b.band)}</td><td>${safeHtml(b.range)}</td><td>${safeHtml(b.descriptor)}</td></tr>`,
        )
        .join(""),
    )
    .join("");
  return buildBrandedHtml({
    title: r.title || "Marking rubric",
    subtitle: `${row.subject} · ${row.level} · Total ${r.total_marks} marks`,
    bodyHtml: `<table><thead><tr><th>Criterion</th><th>Band</th><th>Range</th><th>Descriptor</th></tr></thead><tbody>${rows}</tbody></table>`,
  });
}

export default function RubricGenerator() {
  const { toast } = useToast();
  const saved = useDemoRows<SavedRubric>("rubrics");
  const [subject, setSubject] = useState("English Language");
  const [level, setLevel] = useState("Form 4");
  const [assignment, setAssignment] = useState("");
  const [loading, setLoading] = useState(false);
  const [rubric, setRubric] = useState<Rubric | null>(null);

  const generate = async () => {
    if (!assignment.trim()) {
      toast({ title: "Describe the assignment first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      setRubric(await callTeacherAi<Rubric>("rubric", { assignment, subject, level }));
      toast({ title: "Rubric ready" });
    } catch (e) {
      toast({ title: "Could not generate rubric", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const save = () => {
    if (!rubric) return;
    addRow("rubrics", { subject, level, assignment, content: rubric });
    toast({ title: "Rubric saved" });
    setRubric(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Ruler className="h-5 w-5 text-primary" /> Marking Rubric Generator
          </CardTitle>
          <CardDescription>Criteria and ZIMSEC grade bands for any assignment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
          <div className="space-y-1">
            <Label>Assignment description</Label>
            <Textarea value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="e.g. A 600-word argumentative essay on climate change in Zimbabwe" />
          </div>
          <Button onClick={generate} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate rubric
          </Button>

          {rubric && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="font-medium">{rubric.title} — {rubric.total_marks} marks</p>
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Criterion</TableHead><TableHead>Band</TableHead><TableHead>Range</TableHead><TableHead>Descriptor</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(rubric.criteria || []).flatMap((c) =>
                      (c.bands || []).map((b, i) => (
                        <TableRow key={`${c.criterion}-${b.band}`}>
                          <TableCell className="text-xs">{i === 0 ? `${c.criterion} (${c.weight})` : ""}</TableCell>
                          <TableCell className="text-xs">{b.band}</TableCell>
                          <TableCell className="text-xs">{b.range}</TableCell>
                          <TableCell className="text-xs">{b.descriptor}</TableCell>
                        </TableRow>
                      )),
                    )}
                  </TableBody>
                </Table>
              </div>
              <Button onClick={save}><Save className="mr-2 h-4 w-4" /> Save rubric</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {saved.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base font-heading">Saved rubrics ({saved.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {saved.map((row) => (
              <div key={row.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="font-medium">{row.content?.title || row.assignment}</p>
                  <p className="text-xs text-muted-foreground">{row.subject} · {row.level}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="outline" onClick={() => openPrintWindow(rubricHtml(row))}><Printer className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => removeRow("rubrics", row.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
