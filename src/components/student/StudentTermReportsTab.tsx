import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Loader2, Download, Trophy, TrendingUp, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import ReportCardDownloadButton from "./ReportCardPDF";

interface TermReport {
  id: string;
  academic_year: string;
  term: string;
  form_level: string;
  average_mark: number | null;
  overall_grade: string | null;
  class_rank: number | null;
  class_size: number | null;
  form_rank: number | null;
  form_size: number | null;
  assessment_data: unknown;
  exam_data: unknown;
  class_teacher_comment: string | null;
  head_comment: string | null;
  generated_at: string;
}

const termOptions = ["Term 1", "Term 2", "Term 3"];

export default function StudentTermReportsTab() {
  const { user } = useAuth();
  const [reports, setReports] = useState<TermReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedTerm, setSelectedTerm] = useState("all");
  const [studentInfo, setStudentInfo] = useState<{ id: string; full_name: string; admission_number: string; form: string; stream: string | null } | null>(null);

  useEffect(() => {
    fetchStudentInfo();
  }, [user]);

  async function fetchStudentInfo() {
    if (!user?.id) return;
    
    const { data: student } = await supabase
      .from("students")
      .select("id, full_name, admission_number, form, stream")
      .eq("user_id", user.id)
      .single();

    if (student) {
      setStudentInfo(student);
      fetchReports(student.id);
    } else {
      setLoading(false);
    }
  }

  async function fetchReports(studentId: string) {
    const { data } = await supabase
      .from("term_reports")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_published", true)
      .order("academic_year", { ascending: false })
      .order("term");

    if (data) setReports(data);
    setLoading(false);
  }

  // Get available years
  const availableYears = [...new Set(reports.map(r => r.academic_year))].sort().reverse();

  // Filter reports
  const filteredReports = reports.filter(r => {
    if (selectedYear && r.academic_year !== selectedYear) return false;
    if (selectedTerm && selectedTerm !== "all" && r.term !== selectedTerm) return false;
    return true;
  });

  const selectedReport = filteredReports[0];

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;
  }

  if (!studentInfo) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>Unable to load reports. Student profile not found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Term Reports
          </CardTitle>
          <CardDescription>View and download your academic term reports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-2">
              <Label>Academic Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {availableYears.length > 0 ? (
                    availableYears.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)
                  ) : (
                    <SelectItem value={new Date().getFullYear().toString()}>
                      {new Date().getFullYear()}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Select value={selectedTerm} onValueChange={setSelectedTerm}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Terms</SelectItem>
                  {termOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No term reports available yet</p>
              <p className="text-sm mt-1">Reports will appear here once published by your school</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredReports.map(report => (
                <div key={report.id} className="p-4 rounded-lg border bg-muted/30">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{report.term} {report.academic_year}</h3>
                        <Badge variant="outline">{report.form_level}</Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-accent" />
                          <div>
                            <p className="text-muted-foreground text-xs">Average</p>
                            <p className="font-bold text-lg">{report.average_mark}%</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Grade</p>
                          <Badge className={
                            ["A*", "A"].includes(report.overall_grade) ? "bg-green-100 text-green-800" :
                            report.overall_grade === "B" ? "bg-blue-100 text-blue-800" :
                            report.overall_grade === "C" ? "bg-cyan-100 text-cyan-800" :
                            "bg-amber-100 text-amber-800"
                          }>
                            {report.overall_grade}
                          </Badge>
                        </div>
                        {report.class_rank && (
                          <div className="flex items-center gap-2">
                            <Trophy className="h-4 w-4 text-amber-500" />
                            <div>
                              <p className="text-muted-foreground text-xs">Class Position</p>
                              <p className="font-bold">{report.class_rank} <span className="text-muted-foreground font-normal">of {report.class_size}</span></p>
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-muted-foreground text-xs">Generated</p>
                          <p className="text-sm">{format(new Date(report.generated_at), "dd MMM yyyy")}</p>
                        </div>
                      </div>

                      {/* Comments */}
                      {(report.class_teacher_comment || report.head_comment) && (
                        <div className="mt-3 space-y-2 text-sm">
                          {report.class_teacher_comment && (
                            <div className="p-2 bg-background rounded border">
                              <p className="text-xs text-muted-foreground mb-1">Class Teacher's Comment:</p>
                              <p className="italic">"{report.class_teacher_comment}"</p>
                            </div>
                          )}
                          {report.head_comment && (
                            <div className="p-2 bg-background rounded border">
                              <p className="text-xs text-muted-foreground mb-1">Headmaster's Comment:</p>
                              <p className="italic">"{report.head_comment}"</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Download Button */}
                    <ReportCardDownloadButton
                      studentName={studentInfo.full_name}
                      admissionNumber={studentInfo.admission_number}
                      form={report.form_level}
                      stream={studentInfo.stream}
                      examName={`${report.term} ${report.academic_year}`}
                      term={report.term}
                      academicYear={report.academic_year}
                      results={(Array.isArray(report.exam_data) ? report.exam_data : []).map((r: any) => ({
                        subject_name: r.subjects?.name || "Unknown",
                        subject_code: null,
                        mark: r.mark || 0,
                        grade: r.grade || "U",
                        teacher_comment: null,
                        class_rank: null,
                        class_size: null
                      }))}
                      overallRank={report.class_rank && report.class_size ? { rank: report.class_rank, total: report.class_size } : null}
                      averageMark={report.average_mark ?? 0}
                      averageGrade={report.overall_grade ?? "U"}
                      studentId={studentInfo.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
