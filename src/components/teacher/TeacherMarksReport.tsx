import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import PrintableSection from "@/components/shared/PrintableSection";
import { errorMessage } from "@/lib/errors";
import type { Tables } from "@/integrations/supabase/types";
import { gradeFor } from "@/lib/grading";

interface Props {
  userId: string;
  classes: { id: string; name: string }[];   // classes this teacher teaches
  subjects: { id: string; name: string }[];  // subjects this teacher teaches
}

type AssessmentResultRow = Pick<
  Tables<"assessment_results">,
  "id" | "mark" | "percentage" | "grade" | "is_published" | "created_at" | "graded_by" | "assessment_id" | "student_id"
>;

interface MarkRow {
  id: string;
  source: "manual" | "teacher" | "ai";
  student: string;
  admission: string;
  grade: string;
  subject: string;
  subjectId: string | null;
  description: string;
  type: string;
  term: string;
  scoreLabel: string;
  percent: number;
  created_at: string;
}

export default function TeacherMarksReport({ userId, classes, subjects }: Props) {
  const [classId, setClassId] = useState<string>("all");
  const [subjectId, setSubjectId] = useState<string>("all");
  const [term, setTerm] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [rows, setRows] = useState<MarkRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId, userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`teacher-marks-report-${userId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_results" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "marks" }, () => load())
      .subscribe();

    const onFocus = () => load();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, subjectId, userId]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Which classes are in scope (defaults to every class this teacher teaches,
      //    so search works across all of them unless narrowed with the dropdown)
      const scopeClassIds = classId === "all" ? classes.map(c => c.id) : [classId];
      if (scopeClassIds.length === 0) { setRows([]); return; }

      // 2. Students enrolled in those classes
      const { data: scRows, error: scErr } = await supabase
        .from("student_classes")
        .select("student_id, class_id")
        .in("class_id", scopeClassIds);
      if (scErr) throw new Error(`Could not load class rosters: ${scErr.message}`);

      const studentIds = Array.from(new Set((scRows || []).map((r) => r.student_id)));
      if (studentIds.length === 0) { setRows([]); return; }

      // 3. Student details - fetched separately, not via embedded join
      const { data: studentRows, error: stErr } = await supabase
        .from("students")
        .select("id, full_name, admission_number, form, class")
        .in("id", studentIds);
      if (stErr) throw new Error(`Could not load student details: ${stErr.message}`);
      const studentMap = new Map((studentRows || []).map((s) => [s.id, s]));

      // 4. Manual marks
      let mq = supabase
        .from("marks")
        .select("id, mark, term, assessment_type, comment, created_at, student_id, subject_id")
        .in("student_id", studentIds);
      if (subjectId !== "all") mq = mq.eq("subject_id", subjectId);
      const { data: manual, error: mErr } = await mq.order("created_at", { ascending: false });
      if (mErr) throw new Error(`Could not load manual marks: ${mErr.message}`);

      // 5. Assessments for these classes/subjects
      let aq = supabase
        .from("assessments")
        .select("id, title, assessment_type, max_marks, total_marks, class_id, subject_id")
        .in("class_id", scopeClassIds);
      if (subjectId !== "all") aq = aq.eq("subject_id", subjectId);
      const { data: assessments, error: assessErr } = await aq;
      if (assessErr) throw new Error(`Could not load assessments: ${assessErr.message}`);
      const assessMap = new Map((assessments || []).map((a) => [a.id, a]));
      const assessIds = (assessments || []).map((a) => a.id);

      // 6. AI/teacher-graded assessment results - separately, not embedded.
      //    Scores live in `mark`; `percentage`, `grade` and `is_published` are set
      //    when the teacher (or the auto-marker) grades the submission.
      let arRows: AssessmentResultRow[] = [];
      if (assessIds.length > 0) {
        const { data: ar, error: arErr } = await supabase
          .from("assessment_results")
          .select("id, mark, percentage, grade, is_published, created_at, graded_by, assessment_id, student_id")
          .eq("is_published", true)
          .in("assessment_id", assessIds)
          .in("student_id", studentIds);
        if (arErr) throw new Error(`Could not load assessment results: ${arErr.message}`);
        arRows = ar || [];
      }

      const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

      const manualRows: MarkRow[] = (manual || []).map((m) => {
        const st = studentMap.get(m.student_id);
        return {
          id: `m-${m.id}`,
          source: "manual",
          student: st?.full_name || "-",
          admission: st?.admission_number || "-",
          grade: st?.form || st?.class || "-",
          subject: subjectMap.get(m.subject_id) || "-",
          subjectId: m.subject_id,
          description: m.comment || "-",
          type: m.assessment_type || "-",
          term: m.term || "-",
          scoreLabel: `${m.mark}%`,
          percent: Number(m.mark) || 0,
          created_at: m.created_at,
        };
      });

      const aiRows: MarkRow[] = arRows.map((r) => {
        const a = assessMap.get(r.assessment_id);
        const st = studentMap.get(r.student_id);
        const max = Number(a?.max_marks) || Number(a?.total_marks) || 0;
        const pct = r.percentage != null
          ? Math.round(Number(r.percentage))
          : (max > 0 ? Math.round((Number(r.mark) / max) * 100) : Number(r.mark) || 0);
        return {
          id: `r-${r.id}`,
          source: r.graded_by ? "teacher" : "ai",
          student: st?.full_name || "-",
          admission: st?.admission_number || "-",
          grade: st?.form || st?.class || "-",
          subject: subjectMap.get(a?.subject_id) || "-",
          subjectId: a?.subject_id || null,
          description: a?.title || "Assessment",
          type: a?.assessment_type || "assessment",
          term: "-",
          scoreLabel: max > 0 ? `${r.mark}/${max}` : `${r.mark}`,
          percent: pct,
          created_at: r.created_at,
        };
      });

      const combined = [...manualRows, ...aiRows].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.info("[MarksReport] loaded", {
        classId, subjectId, students: studentIds.length,
        assessments: (assessments || []).length, aiRows: aiRows.length, manualRows: manualRows.length,
      });

      setRows(combined);
    } catch (e) {
      console.error("[MarksReport] load failed", e);
      setError(errorMessage(e, "Failed to load marks."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (term !== "all" && r.term !== term) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !r.student.toLowerCase().includes(q) &&
          !r.admission.toLowerCase().includes(q) &&
          !r.subject.toLowerCase().includes(q) &&
          !r.description.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [rows, term, search]);

  const overall = filtered.length
    ? Math.round(filtered.reduce((a, r) => a + r.percent, 0) / filtered.length)
    : 0;

  const bySubject = useMemo(() => {
    const map: Record<string, { total: number; n: number }> = {};
    filtered.forEach(r => {
      map[r.subject] = map[r.subject] || { total: 0, n: 0 };
      map[r.subject].total += r.percent;
      map[r.subject].n += 1;
    });
    return Object.entries(map)
      .map(([subject, v]) => ({ subject, avg: Math.round(v.total / v.n), n: v.n }))
      .sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const byStudent = useMemo(() => {
    const map: Record<string, { name: string; admission: string; total: number; n: number }> = {};
    filtered.forEach(r => {
      const k = r.admission + "|" + r.student;
      map[k] = map[k] || { name: r.student, admission: r.admission, total: 0, n: 0 };
      map[k].total += r.percent;
      map[k].n += 1;
    });
    return Object.values(map)
      .map(s => ({ ...s, avg: Math.round(s.total / s.n) }))
      .sort((a, b) => b.avg - a.avg);
  }, [filtered]);

  const className = classId === "all" ? "All My Classes" : (classes.find(c => c.id === classId)?.name || "Class");
  const subjectName = subjectId === "all" ? "All Subjects" : (subjects.find(s => s.id === subjectId)?.name || "Subject");
  const subtitle = `${className} · ${subjectName}${term !== "all" ? ` · ${term}` : ""} · ${filtered.length} record${filtered.length === 1 ? "" : "s"} · Overall average ${overall}%`;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Form / Class</label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All My Classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Term</label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Terms</SelectItem>
                <SelectItem value="Term 1">Term 1</SelectItem>
                <SelectItem value="Term 2">Term 2</SelectItem>
                <SelectItem value="Term 3">Term 3</SelectItem>
                <SelectItem value="Term 4">Term 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Search (all my classes)</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Student, subject, assessment…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <PrintableSection
        title={`Marks Report: ${className}`}
        subtitle={subtitle}
        fileName={`marks-${className}`.replace(/\s+/g, "-").toLowerCase()}
      >
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading marks…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-6 text-center">{error}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No marks match the current filters.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Overall Average</p>
                <p className="text-2xl font-bold text-primary">{overall}%</p>
                <p className="text-xs">Grade {gradeFor(overall)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Records</p>
                <p className="text-2xl font-bold">{filtered.length}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">Students</p>
                <p className="text-2xl font-bold">{byStudent.length}</p>
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Class Averages by Subject</h4>
              <table className="w-full text-sm border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Subject</th>
                    <th className="px-3 py-2 text-center">Records</th>
                    <th className="px-3 py-2 text-center">Average</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {bySubject.map(s => (
                    <tr key={s.subject} className="border-t">
                      <td className="px-3 py-2">{s.subject}</td>
                      <td className="px-3 py-2 text-center">{s.n}</td>
                      <td className="px-3 py-2 text-center font-bold">{s.avg}%</td>
                      <td className="px-3 py-2 text-center">{gradeFor(s.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">Student Rankings</h4>
              <table className="w-full text-sm border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Admission</th>
                    <th className="px-3 py-2 text-center">Records</th>
                    <th className="px-3 py-2 text-center">Average</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {byStudent.map((s, i) => (
                    <tr key={s.admission} className="border-t">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">{s.name}</td>
                      <td className="px-3 py-2">{s.admission}</td>
                      <td className="px-3 py-2 text-center">{s.n}</td>
                      <td className="px-3 py-2 text-center font-bold">{s.avg}%</td>
                      <td className="px-3 py-2 text-center">{gradeFor(s.avg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h4 className="font-semibold text-sm mb-2">All Marks</h4>
              <table className="w-full text-sm border">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Grade</th>
                    <th className="px-3 py-2 text-left">Subject</th>
                    <th className="px-3 py-2 text-left">Assessment</th>
                    <th className="px-3 py-2 text-center">Type</th>
                    <th className="px-3 py-2 text-center">Term</th>
                    <th className="px-3 py-2 text-center">Source</th>
                    <th className="px-3 py-2 text-center">Score</th>
                    <th className="px-3 py-2 text-center">%</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">{new Date(r.created_at).toLocaleDateString("en-GB")}</td>
                      <td className="px-3 py-2">{r.student}</td>
                      <td className="px-3 py-2">{r.grade}</td>
                      <td className="px-3 py-2">{r.subject}</td>
                      <td className="px-3 py-2">{r.description}</td>
                      <td className="px-3 py-2 text-center capitalize">{r.type}</td>
                      <td className="px-3 py-2 text-center">{r.term}</td>
                      <td className="px-3 py-2 text-center">
                        {r.source === "ai" ? (
                          <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-300">
                            <Sparkles className="h-3 w-3 mr-1" />AI
                          </Badge>
                        ) : (
                          <Badge variant="outline">{r.source === "teacher" ? "Teacher" : "Manual"}</Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center font-semibold">{r.scoreLabel}</td>
                      <td className="px-3 py-2 text-center">{r.percent}%</td>
                      <td className="px-3 py-2 text-center">{gradeFor(r.percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </PrintableSection>
    </div>
  );
}
