import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Award, TrendingUp, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ReportCardDownloadButton from "./ReportCardPDF";
import { gradeFor, gradeBadgeClass } from "@/lib/grading";
import type { ExamRankings } from "@/types/school";

interface Props {
  studentId: string | null;
  studentName?: string;
  admissionNumber?: string;
  form?: string;
  stream?: string | null;
}

interface ExamOption {
  id: string;
  name: string;
  term: string;
  academic_year: string;
  form_level: string;
  exam_type: string;
}

interface ResultRow {
  id: string;
  mark: number;
  grade: string | null;
  teacher_comment: string | null;
  subject_name: string;
  subject_code: string | null;
  class_rank: number | null;
  class_size: number | null;
}

function getMarkBarColor(mark: number): string {
  if (mark >= 80) return "bg-emerald-500";
  if (mark >= 60) return "bg-purple-500";
  if (mark >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export default function StudentExamResultsTab({ studentId, studentName, admissionNumber, form, stream }: Props) {
  const [exams, setExams] = useState<ExamOption[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [overallRank, setOverallRank] = useState<{ rank: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    if (studentId) fetchExams();
  }, [studentId]);

  const fetchExams = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("exams")
      .select("id, name, term, academic_year, form_level, exam_type")
      .eq("is_published", true)
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false });

    const examList = (data || []) as ExamOption[];
    setExams(examList);
    if (examList.length > 0) {
      setSelectedExamId(examList[0].id);
    }
    setLoading(false);
  };

  const fetchResults = useCallback(async () => {
    if (!selectedExamId || !studentId) return;
    setResultsLoading(true);

    // Get this student's results
    const [{ data: myResults }, { data: rankingsData }] = await Promise.all([
      supabase
        .from("exam_results")
        .select("id, mark, grade, teacher_comment:comment, subject_id, subjects(name, code)")
        .eq("exam_id", selectedExamId)
        .eq("student_id", studentId)
        .order("mark", { ascending: false }),
      supabase.rpc("get_exam_rankings", { p_exam_id: selectedExamId, p_student_id: studentId }),
    ]);

    const rankings = (rankingsData as ExamRankings | null) ?? {};
    const subjectRankings = rankings.subject_rankings || {};

    setOverallRank(
      rankings.overall_rank
        ? { rank: rankings.overall_rank, total: rankings.total_students }
        : null
    );

    // Build result rows
    const rows: ResultRow[] = (myResults || []).map((r) => {
      const subjectId = r.subject_id;
      const sr = subjectId ? subjectRankings[subjectId] : undefined;

      return {
        id: r.id,
        mark: r.mark,
        grade: r.grade || gradeFor(r.mark),
        teacher_comment: r.teacher_comment,
        subject_name: r.subjects?.name || "Unknown",
        subject_code: r.subjects?.code || null,
        class_rank: sr?.rank ?? null,
        class_size: sr?.total ?? null,
      };
    });

    setResults(rows);
    setResultsLoading(false);
  }, [selectedExamId, studentId]);

  useEffect(() => {
    if (selectedExamId && studentId) fetchResults();
  }, [fetchResults, selectedExamId, studentId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (exams.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No published exam results yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Results will appear here once they are released.</p>
        </CardContent>
      </Card>
    );
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const totalMarks = results.reduce((sum, r) => sum + r.mark, 0);
  const avgMark = results.length > 0 ? Math.round(totalMarks / results.length) : 0;
  const avgGrade = gradeFor(avgMark);
  const bestSubject = results.length > 0 ? results[0] : null;

  return (
    <div className="space-y-4">
      {/* Exam Selector */}
      <Select value={selectedExamId || ""} onValueChange={setSelectedExamId}>
        <SelectTrigger>
          <SelectValue placeholder="Select an exam" />
        </SelectTrigger>
        <SelectContent>
          {exams.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name} · {e.term} {e.academic_year}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {resultsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              No results found for {selectedExam?.name || "this exam"}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-2">
            <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
              <CardContent className="p-3 text-center">
                <TrendingUp className="mx-auto mb-1 h-5 w-5 text-secondary" />
                <p className="text-lg font-bold text-secondary">{avgMark}%</p>
                <p className="text-[10px] text-muted-foreground">Average</p>
                <Badge className={`mt-1 text-[10px] ${gradeBadgeClass(avgGrade)}`} variant="outline">
                  {avgGrade}
                </Badge>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/40">
              <CardContent className="p-3 text-center">
                <Trophy className="mx-auto mb-1 h-5 w-5 text-amber-600" />
                <p className="text-lg font-bold text-amber-700">
                  {overallRank ? `${overallRank.rank}` : "-"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {overallRank ? `of ${overallRank.total}` : "Class Rank"}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/40">
              <CardContent className="p-3 text-center">
                <Award className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
                <p className="text-xs font-bold text-emerald-700 truncate">
                  {bestSubject?.subject_name || "-"}
                </p>
                <p className="text-lg font-bold text-emerald-700">{bestSubject?.mark || 0}%</p>
                <p className="text-[10px] text-muted-foreground">Best Subject</p>
              </CardContent>
            </Card>
          </div>

          {/* Download Report Card */}
          <div className="flex justify-end">
            <ReportCardDownloadButton
              studentName={studentName || "Student"}
              admissionNumber={admissionNumber || "N/A"}
              form={form || "N/A"}
              stream={stream || null}
              examName={selectedExam?.name || "Exam"}
              term={selectedExam?.term || ""}
              academicYear={selectedExam?.academic_year || ""}
              results={results.map((r) => ({
                subject_name: r.subject_name,
                subject_code: r.subject_code,
                mark: r.mark,
                grade: r.grade || gradeFor(r.mark),
                teacher_comment: r.teacher_comment,
                class_rank: r.class_rank,
                class_size: r.class_size,
              }))}
              overallRank={overallRank}
              averageMark={avgMark}
              averageGrade={avgGrade}
              studentId={studentId}
            />
          </div>

          {/* Results Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Subject</th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Mark</th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Grade</th>
                      <th className="px-3 py-2.5 text-center font-medium text-muted-foreground hidden sm:table-cell">Rank</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-3 py-3">
                          <p className="font-medium text-foreground">{r.subject_name}</p>
                          {r.teacher_comment && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                              {r.teacher_comment}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col items-center gap-1">
                            <span className="font-bold text-foreground">{r.mark}%</span>
                            <div className="w-14 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${getMarkBarColor(r.mark)}`}
                                style={{ width: `${r.mark}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <Badge className={`text-xs ${gradeBadgeClass(r.grade || "U")}`} variant="outline">
                            {r.grade}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-center hidden sm:table-cell">
                          {r.class_rank && r.class_size ? (
                            <span className="text-xs text-muted-foreground">
                              <span className="font-semibold text-foreground">{r.class_rank}</span>
                              /{r.class_size}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/50 font-medium">
                      <td className="px-3 py-2.5">Overall Average</td>
                      <td className="px-3 py-2.5 text-center font-bold">{avgMark}%</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge className={`text-xs ${gradeBadgeClass(avgGrade)}`} variant="outline">
                          {avgGrade}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                        {overallRank ? (
                          <span className="text-xs">
                            <span className="font-semibold">{overallRank.rank}</span>/{overallRank.total}
                          </span>
                        ) : "-"}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
