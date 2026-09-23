import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Minus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { ClassOption, SubjectOption } from "@/types/school";
import type { Tables } from "@/integrations/supabase/types";
import { gradeFor } from "@/lib/grading";

/** A mark or exam result, normalised for trend display. */
type ProgressMark = { student_id: string | null; mark: number; term: string; created_at: string; subjects?: { name: string } | null };

interface Props {
  userId: string;
  classes: ClassOption[];
  subjects: SubjectOption[];
}

export default function StudentProgressTracker({ userId, classes, subjects }: Props) {
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [marks, setMarks] = useState<ProgressMark[]>([]);
  const [students, setStudents] = useState<Pick<Tables<"students">, "id" | "full_name" | "admission_number">[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (classes.length > 0 && !selectedClass) setSelectedClass(classes[0].id);
  }, [classes, selectedClass]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: sc } = await supabase.from("student_classes").select("student_id").eq("class_id", selectedClass);
    const studentIds = sc?.map(s => s.student_id) || [];

    if (studentIds.length > 0) {
      const { data: studs } = await supabase.from("students").select("id, full_name, admission_number").in("id", studentIds).eq("status", "active").order("full_name");
      if (studs) setStudents(studs);

      // Fetch marks from all teachers
      let marksQuery = supabase.from("marks").select("*, subjects(name)").in("student_id", studentIds);
      if (selectedSubject !== "all") marksQuery = marksQuery.eq("subject_id", selectedSubject);
      const { data: m } = await marksQuery.order("created_at", { ascending: true });

      // Fetch exam results too
      let examQuery = supabase.from("exam_results").select("*, subjects(name), exams(name, term, academic_year)").in("student_id", studentIds);
      if (selectedSubject !== "all") examQuery = examQuery.eq("subject_id", selectedSubject);
      const { data: er } = await examQuery.order("created_at", { ascending: true });

      // Normalize exam results into the same shape as marks
      const normalizedExamResults = (er || []).map(r => ({
        ...r,
        mark: r.mark,
        term: r.exams?.term || "Exam",
        assessment_type: "exam",
        _source: "exam",
      }));

      const allMarks = [...(m || []).map(mk => ({ ...mk, _source: "marks" })), ...normalizedExamResults];
      setMarks(allMarks);
    } else {
      setStudents([]);
      setMarks([]);
    }
    setLoading(false);
  }, [selectedClass, selectedSubject]);

  useEffect(() => {
    if (selectedClass) loadData();
  }, [loadData, selectedClass, selectedSubject]);

  // Build per-student summary
  const studentSummaries = students.map(s => {
    const sMarks = marks.filter(m => m.student_id === s.id);
    const avg = sMarks.length > 0 ? Math.round(sMarks.reduce((a, m) => a + m.mark, 0) / sMarks.length) : null;
    const sorted = [...sMarks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const recent = sorted.slice(-3);
    const trend = recent.length >= 2 ? recent[recent.length - 1].mark - recent[0].mark : 0;

    // Per-term averages
    const terms: Record<string, number[]> = {};
    sMarks.forEach(m => {
      if (!terms[m.term]) terms[m.term] = [];
      terms[m.term].push(m.mark);
    });
    const termAvgs = Object.entries(terms).map(([term, mks]) => ({
      term, avg: Math.round(mks.reduce((a, b) => a + b, 0) / mks.length),
    }));

    return { ...s, marks: sMarks, avg, trend, termAvgs, recent };
  }).sort((a, b) => (b.avg || 0) - (a.avg || 0));

  const classAvg = studentSummaries.filter(s => s.avg !== null).length > 0
    ? Math.round(studentSummaries.filter(s => s.avg !== null).reduce((a, s) => a + (s.avg || 0), 0) / studentSummaries.filter(s => s.avg !== null).length)
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg font-bold">Student Progress Tracker</h2>
        <p className="text-sm text-muted-foreground">Monitor individual student performance trends across terms.</p>
      </div>

      <div className="flex gap-3">
        <Select value={selectedClass} onValueChange={setSelectedClass}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select class" /></SelectTrigger>
          <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={selectedSubject} onValueChange={setSelectedSubject}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Class Overview */}
      {classAvg !== null && (
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{classAvg}%</p>
            <p className="text-xs text-muted-foreground">Class Average</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{studentSummaries.length}</p>
            <p className="text-xs text-muted-foreground">Students</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{marks.length}</p>
            <p className="text-xs text-muted-foreground">Total Marks</p>
          </CardContent></Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : studentSummaries.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No student data available for this class.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {studentSummaries.map((s, i) => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <div>
                      <p className="text-sm font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Term averages */}
                    <div className="hidden sm:flex gap-2">
                      {s.termAvgs.map(t => (
                        <div key={t.term} className="text-center">
                          <p className="text-xs text-muted-foreground">{t.term}</p>
                          <Badge variant="secondary" className="text-xs">{t.avg}%</Badge>
                        </div>
                      ))}
                    </div>
                    {/* Overall */}
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary">{s.avg !== null ? `${s.avg}%` : "—"}</p>
                      {s.avg !== null && <Badge className="text-[10px]">{gradeFor(s.avg)}</Badge>}
                    </div>
                    {/* Trend */}
                    {s.trend > 2 ? <TrendingUp className="h-5 w-5 text-green-500" /> :
                     s.trend < -2 ? <TrendingDown className="h-5 w-5 text-red-500" /> :
                     <Minus className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </div>
                {/* Mini bar */}
                {s.recent.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {s.recent.map((m, mi) => (
                      <div key={mi} className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${m.mark}%` }} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
