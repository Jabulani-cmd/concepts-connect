import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { gradeFor, gradeBadgeClass } from "@/lib/grading";

interface Props {
  studentId: string | null;
}

const termOptions = ["Term 1", "Term 2", "Term 3"];

export default function StudentMarksTab({ studentId }: Props) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState("all");

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    fetchAll();

    const ch = supabase
      .channel(`student-marks-${studentId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "marks", filter: `student_id=eq.${studentId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_results", filter: `student_id=eq.${studentId}` }, () => fetchAll())
      .subscribe();


    const onFocus = () => fetchAll();
    window.addEventListener("focus", onFocus);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("focus", onFocus);
    };
  }, [studentId]);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: marks }, { data: results }] = await Promise.all([
      supabase.from("marks").select("*, subjects(name)").eq("student_id", studentId).order("created_at", { ascending: false }),
      supabase.from("assessment_results")
        .select("id, mark, feedback, graded_by, created_at, assessment_id, assessments(title, max_marks, assessment_type, subjects(name))")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
    ]);

    const manual = (marks || []).map((m: any) => ({
      id: `m-${m.id}`,
      source: "manual" as const,
      subjectName: m.subjects?.name || "—",
      description: m.comment || m.description || "—",
      assessmentType: m.assessment_type || "—",
      term: m.term,
      percent: Number(m.mark) || 0,
      scoreLabel: `${m.mark}%`,
      feedback: m.comment || null,
      created_at: m.created_at,
    }));

    const ai = (results || []).map((r: any) => {
      const max = Number(r.assessments?.max_marks) || 0;
      const scored = Number(r.mark) || 0;
      const pct = max > 0 ? Math.round((scored / max) * 100) : scored;
      return {
        id: `r-${r.id}`,
        source: r.graded_by ? "teacher" as const : "ai" as const,
        subjectName: r.assessments?.subjects?.name || "—",
        description: r.assessments?.title || "Assessment",
        assessmentType: r.assessments?.assessment_type || "assessment",
        term: null,
        percent: pct,
        scoreLabel: max > 0 ? `${scored}/${max}` : `${scored}`,
        feedback: r.feedback || null,
        created_at: r.created_at,
      };
    });

    const merged = [...manual, ...ai].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setRows(merged);
    setLoading(false);
  };

  const filtered = rows.filter(r => selectedTerm === "all" || r.term === selectedTerm);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Select value={selectedTerm} onValueChange={setSelectedTerm}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Filter by term" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Terms</SelectItem>
          {termOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
        </SelectContent>
      </Select>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No marks recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Subject</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Assessment</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Source</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Score</th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const grade = gradeFor(r.percent);
                    return (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top">
                        <td className="px-3 py-3 font-medium">{r.subjectName}</td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {r.description}
                          {r.feedback && r.source === "ai" && (
                            <p className="text-[11px] text-muted-foreground/80 mt-1 italic">{r.feedback}</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center capitalize">{r.assessmentType}</td>
                        <td className="px-3 py-3 text-center">
                          {r.source === "ai" ? (
                            <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-300">
                              <Sparkles className="h-3 w-3 mr-1" /> AI Marked
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">Teacher</Badge>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center font-bold">{r.scoreLabel}</td>
                        <td className="px-3 py-3 text-center">
                          <Badge className={`text-xs ${gradeBadgeClass(grade)}`} variant="outline">{grade}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
