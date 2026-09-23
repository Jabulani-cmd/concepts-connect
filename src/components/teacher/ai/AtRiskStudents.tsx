import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi } from "@/lib/teacherAi";
import { addRow, replaceAll, updateRow, useDemoRows } from "@/lib/teacherAiStore";

interface StudentLike {
  id: string;
  full_name?: string;
  name?: string;
  form?: string;
  class?: string;
}

interface Signals {
  attendance_term_average: number;
  attendance_last_4_weeks: number;
  subjects_declining: { subject: string; from: number; to: number }[];
  assignment_submission_rate: number;
}

/** Deterministic demo signals so the same learner always produces the same picture. */
function seeded(id: string, salt: number) {
  let h = salt;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
  return h / 100000;
}

function buildSignals(s: StudentLike): Signals {
  const termAtt = Math.round(80 + seeded(s.id, 7) * 18);
  const drop = Math.round(seeded(s.id, 13) * 30);
  const recentAtt = Math.max(40, termAtt - drop);
  const subjects = ["Mathematics", "English Language", "Combined Science", "Geography"];
  const declining = subjects
    .filter((_, i) => seeded(s.id, 21 + i) > 0.68)
    .map((subject, i) => {
      const from = Math.round(55 + seeded(s.id, 31 + i) * 25);
      return { subject, from, to: Math.max(25, from - Math.round(8 + seeded(s.id, 41 + i) * 18)) };
    });
  return {
    attendance_term_average: termAtt,
    attendance_last_4_weeks: recentAtt,
    subjects_declining: declining,
    assignment_submission_rate: Math.round(50 + seeded(s.id, 57) * 50),
  };
}

/** Rules-based points first — the AI only explains the result. */
function scoreSignals(sig: Signals) {
  let points = 0;
  const attendanceDrop = sig.attendance_term_average - sig.attendance_last_4_weeks;
  if (attendanceDrop > 20) points += 2;
  else if (attendanceDrop > 10) points += 1;

  const bigDrops = sig.subjects_declining.filter((d) => d.from - d.to > 10);
  if (bigDrops.length >= 2) points += 2;
  else if (bigDrops.length === 1) points += 1;

  if (sig.assignment_submission_rate < 70) points += 1;

  const level = points >= 4 ? "high" : points >= 2 ? "medium" : points >= 1 ? "low" : null;
  return { points, level };
}

type RiskFlag = {
  student_id: string;
  student_name: string;
  class_name: string;
  risk_score: "high" | "medium" | "low";
  points: number;
  reason: string;
  signals_used: Signals;
  suggested_actions: string[];
  status: "new" | "reviewed" | "actioned";
  review_note?: string;
};

const COLOURS: Record<string, string> = {
  high: "bg-destructive text-destructive-foreground",
  medium: "bg-amber-500 text-white",
  low: "bg-muted text-foreground",
};

interface Props {
  students?: StudentLike[];
}

export default function AtRiskStudents({ students = [] }: Props) {
  const { toast } = useToast();
  const flags = useDemoRows<RiskFlag>("student_risk_flags");
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const runScan = async () => {
    if (students.length === 0) {
      toast({ title: "No learners in your classes yet", variant: "destructive" });
      return;
    }
    setRunning(true);
    replaceAll("student_risk_flags", []);
    try {
      const candidates = students
        .map((s) => ({ s, sig: buildSignals(s) }))
        .map((x) => ({ ...x, score: scoreSignals(x.sig) }))
        .filter((x) => x.score.level)
        .sort((a, b) => b.score.points - a.score.points)
        .slice(0, 8);

      for (const c of candidates) {
        const name = c.s.full_name || c.s.name || "Learner";
        let reason = "";
        let actions: string[] = [];
        try {
          const res = await callTeacherAi<{ reason: string; suggested_actions: string[] }>("risk_reason", {
            student: name,
            signals: c.sig,
            risk_score: c.score.level,
          });
          reason = res.reason;
          actions = res.suggested_actions || [];
        } catch {
          reason = `Attendance moved from ${c.sig.attendance_term_average}% to ${c.sig.attendance_last_4_weeks}% over the last 4 weeks, with ${c.sig.assignment_submission_rate}% of assignments submitted.`;
          actions = ["Arrange a short check-in with the learner"];
        }
        addRow<RiskFlag>("student_risk_flags", {
          student_id: c.s.id,
          student_name: name,
          class_name: c.s.class || c.s.form || "",
          risk_score: c.score.level as RiskFlag["risk_score"],
          points: c.score.points,
          reason,
          signals_used: c.sig,
          suggested_actions: actions,
          status: "new",
        });
      }
      toast({ title: "Scan complete", description: `${candidates.length} learner(s) flagged.` });
    } finally {
      setRunning(false);
    }
  };

  const mark = (id: string, status: "reviewed" | "actioned") => {
    updateRow("student_risk_flags", id, {
      status,
      reviewed_at: new Date().toISOString(),
      review_note: notes[id] || "",
    });
    toast({ title: status === "reviewed" ? "Marked as reviewed" : "Marked as actioned" });
  };

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...flags].sort((a, b) => (order[a.risk_score] ?? 3) - (order[b.risk_score] ?? 3));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" /> At-Risk Learners
            <Badge variant="secondary">Your classes only</Badge>
          </CardTitle>
          <CardDescription>
            Attendance trends, grade trends and assignment submission are scored, then explained in plain language with
            suggested next steps. Run the check whenever you want an update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={runScan} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Run risk check
          </Button>
        </CardContent>
      </Card>

      {sorted.map((f) => (
        <Card key={f.id} className="border-l-4" style={{ borderLeftColor: f.risk_score === "high" ? "hsl(var(--destructive))" : undefined }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base font-heading">
              {f.student_name}
              <Badge className={COLOURS[f.risk_score]}>{f.risk_score} risk</Badge>
              {f.class_name && <span className="text-xs font-normal text-muted-foreground">{f.class_name}</span>}
              {f.status !== "new" && <Badge variant="outline">{f.status}</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{f.reason}</p>
            {f.suggested_actions?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">Suggested next steps</p>
                <ul className="ml-5 list-disc">{f.suggested_actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
              </div>
            )}
            <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
              <span>Attendance: {f.signals_used?.attendance_term_average}% → {f.signals_used?.attendance_last_4_weeks}%</span>
              <span>Assignments submitted: {f.signals_used?.assignment_submission_rate}%</span>
              <span>Subjects declining: {f.signals_used?.subjects_declining?.length || 0}</span>
            </div>
            {f.status === "new" && (
              <div className="space-y-2">
                <Label className="text-xs">Note (optional)</Label>
                <Input value={notes[f.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [f.id]: e.target.value }))} placeholder="e.g. Called guardian on Monday" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => mark(f.id, "reviewed")}><CheckCircle2 className="mr-2 h-4 w-4" /> Mark reviewed</Button>
                  <Button size="sm" onClick={() => mark(f.id, "actioned")}><ShieldCheck className="mr-2 h-4 w-4" /> Mark actioned</Button>
                </div>
              </div>
            )}
            {f.review_note && <p className="text-xs text-muted-foreground">Note: {f.review_note}</p>}
          </CardContent>
        </Card>
      ))}

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">No flags yet — run the risk check to see learners who may need support.</p>
      )}
    </div>
  );
}
