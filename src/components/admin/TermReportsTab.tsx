import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FileText, Loader2, RefreshCw, CheckCircle, Send, Eye } from "lucide-react";
import { format } from "date-fns";
import { errorMessage } from "@/lib/errors";
import { gradeFor, gradeBadgeClass } from "@/lib/grading";

const formOptions = ["Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12"];
const termOptions = ["Term 1", "Term 2", "Term 3"];

interface TermReport {
  id: string;
  student_id: string;
  academic_year: string;
  term: string;
  form_level: string;
  average_mark: number;
  overall_grade: string;
  class_rank: number | null;
  class_size: number | null;
  is_published: boolean;
  generated_at: string;
  students?: { full_name: string; admission_number: string };
}

interface Student {
  id: string;
  full_name: string;
  admission_number: string;
  form: string;
}

export default function TermReportsTab() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reports, setReports] = useState<TermReport[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  
  // Filters
  const [filterForm, setFilterForm] = useState("Grade 8");
  const [filterTerm, setFilterTerm] = useState("Term 1");
  const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
  
  // Selection for bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [filterForm, filterTerm, filterYear]);

  async function fetchData() {
    const { data } = await supabase
      .from("students")
      .select("id, full_name, admission_number, form")
      .eq("status", "active")
      
      .order("full_name");
    if (data) setStudents(data);
    setLoading(false);
  }

  async function fetchReports() {
    const { data } = await supabase
      .from("term_reports")
      .select("*, students(full_name, admission_number)")
      .eq("form_level", filterForm)
      .eq("term", filterTerm)
      .eq("academic_year", filterYear)
      .order("class_rank", { nullsFirst: false });
    if (data) setReports(data);
  }

  async function generateReports() {
    setGenerating(true);
    try {
      const formStudents = students.filter(s => s.form === filterForm);
      if (formStudents.length === 0) {
        toast({ title: "No students", description: "No active students in this form level", variant: "destructive" });
        setGenerating(false);
        return;
      }

      // Get exam results for this form, term, year
      const { data: exams } = await supabase
        .from("exams")
        .select("id")
        .eq("form_level", filterForm)
        .eq("term", filterTerm)
        .eq("academic_year", filterYear);

      const examIds = exams?.map(e => e.id) || [];

      // Get assessment results for students in this form
      const { data: assessmentResults } = await supabase
        .from("assessment_results")
        .select("student_id, mark, percentage, grade")
        .in("student_id", formStudents.map(s => s.id))
        .eq("is_published", true);

      // Get exam results
      const { data: examResults } = await supabase
        .from("exam_results")
        .select("student_id, subject_id, mark, grade, subjects(name)")
        .in("exam_id", examIds);

      // Calculate averages and rankings
      const studentAverages: { id: string; total: number; count: number; avg: number }[] = [];

      for (const student of formStudents) {
        const studentExamResults = examResults?.filter(r => r.student_id === student.id) || [];
        const studentAssessResults = assessmentResults?.filter(r => r.student_id === student.id) || [];

        // Calculate weighted average (exams 70%, assessments 30%)
        let examTotal = 0, examCount = 0;
        studentExamResults.forEach(r => { examTotal += r.mark; examCount++; });
        
        let assessTotal = 0, assessCount = 0;
        studentAssessResults.forEach(r => { 
          if (r.percentage) { assessTotal += r.percentage; assessCount++; }
        });

        const examAvg = examCount > 0 ? examTotal / examCount : 0;
        const assessAvg = assessCount > 0 ? assessTotal / assessCount : 0;
        
        // Weighted average
        let finalAvg = 0;
        if (examCount > 0 && assessCount > 0) {
          finalAvg = (examAvg * 0.7) + (assessAvg * 0.3);
        } else if (examCount > 0) {
          finalAvg = examAvg;
        } else if (assessCount > 0) {
          finalAvg = assessAvg;
        }

        studentAverages.push({ id: student.id, total: examTotal + assessTotal, count: examCount + assessCount, avg: finalAvg });
      }

      // Sort by average and assign ranks
      studentAverages.sort((a, b) => b.avg - a.avg);
      const classSize = studentAverages.filter(s => s.count > 0).length;

      // Delete existing reports for this combination
      await supabase
        .from("term_reports")
        .delete()
        .eq("form_level", filterForm)
        .eq("term", filterTerm)
        .eq("academic_year", filterYear);

      // Create new reports
      const reportsToInsert = studentAverages
        .filter(s => s.count > 0)
        .map((s, idx) => ({
          student_id: s.id,
          academic_year: filterYear,
          term: filterTerm,
          form_level: filterForm,
          total_marks: s.total,
          average_mark: Math.round(s.avg * 100) / 100,
          overall_grade: gradeFor(s.avg),
          class_rank: idx + 1,
          class_size: classSize,
          assessment_data: assessmentResults?.filter(r => r.student_id === s.id) || [],
          exam_data: examResults?.filter(r => r.student_id === s.id) || [],
          generated_by: user?.id,
          is_published: false
        }));

      if (reportsToInsert.length > 0) {
        const { error } = await supabase.from("term_reports").insert(reportsToInsert);
        if (error) throw error;
      }

      toast({ title: "Reports generated", description: `${reportsToInsert.length} reports created` });
      fetchReports();
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setGenerating(false);
  }

  async function togglePublish(reportId: string, currentStatus: boolean) {
    await supabase.from("term_reports").update({ is_published: !currentStatus }).eq("id", reportId);
    toast({ title: currentStatus ? "Report unpublished" : "Report published" });
    fetchReports();
  }

  async function publishSelected() {
    if (selectedIds.length === 0) return;
    await supabase.from("term_reports").update({ is_published: true }).in("id", selectedIds);
    toast({ title: "Reports published", description: `${selectedIds.length} reports published` });
    setSelectedIds([]);
    fetchReports();
  }

  async function notifyParents() {
    const publishedReports = reports.filter(r => r.is_published);
    if (publishedReports.length === 0) {
      toast({ title: "No published reports", variant: "destructive" });
      return;
    }

    // Get parent links
    const { data: parentLinks } = await supabase
      .from("parent_students")
      .select("parent_id, student_id")
      .in("student_id", publishedReports.map(r => r.student_id));

    if (parentLinks && parentLinks.length > 0) {
      const notifications = parentLinks.map(pl => ({
        user_id: pl.parent_id,
        title: "Term Report Available",
        message: `The ${filterTerm} ${filterYear} report for your child is now available. Please check your dashboard.`,
        type: "term_report"
      }));

      await supabase.from("notifications").insert(notifications);
      toast({ title: "Parents notified", description: `${parentLinks.length} notifications sent` });
    } else {
      toast({ title: "No linked parents found", variant: "destructive" });
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === reports.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reports.map(r => r.id));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="font-heading">Term Reports</CardTitle>
            <CardDescription>Generate comprehensive end-of-term reports combining assessments and exam results</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2">
            <Label>Form Level</Label>
            <Select value={filterForm} onValueChange={setFilterForm}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {formOptions.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Term</Label>
            <Select value={filterTerm} onValueChange={setFilterTerm}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {termOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Year</Label>
            <Input value={filterYear} onChange={e => setFilterYear(e.target.value)} className="w-[100px]" />
          </div>
          <Button onClick={generateReports} disabled={generating} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            {generating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Generate Reports
          </Button>
          {reports.length > 0 && (
            <>
              <Button onClick={publishSelected} disabled={selectedIds.length === 0} variant="outline">
                <CheckCircle className="mr-1 h-4 w-4" /> Publish Selected ({selectedIds.length})
              </Button>
              <Button onClick={notifyParents} variant="outline">
                <Send className="mr-1 h-4 w-4" /> Notify Parents
              </Button>
            </>
          )}
        </div>

        {/* Stats */}
        {reports.length > 0 && (
          <div className="flex gap-4 text-sm">
            <span>Total: <strong>{reports.length}</strong></span>
            <span className="text-green-600">Published: <strong>{reports.filter(r => r.is_published).length}</strong></span>
            <span className="text-amber-600">Draft: <strong>{reports.filter(r => !r.is_published).length}</strong></span>
          </div>
        )}

        {/* Reports Table */}
        {reports.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox 
                      checked={selectedIds.length === reports.length && reports.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Rank</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Adm #</TableHead>
                  <TableHead>Average</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map(report => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.includes(report.id)}
                        onCheckedChange={() => toggleSelect(report.id)}
                      />
                    </TableCell>
                    <TableCell className="font-bold text-lg">
                      {report.class_rank}
                      <span className="text-xs text-muted-foreground font-normal">/{report.class_size}</span>
                    </TableCell>
                    <TableCell className="font-medium">{report.students?.full_name}</TableCell>
                    <TableCell className="text-xs">{report.students?.admission_number}</TableCell>
                    <TableCell className="font-semibold">{report.average_mark}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={gradeBadgeClass(report.overall_grade)}>
                        {report.overall_grade}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={report.is_published ? "default" : "outline"}>
                        {report.is_published ? "Published" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(report.generated_at), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => togglePublish(report.id, report.is_published)}
                          title={report.is_published ? "Unpublish" : "Publish"}
                        >
                          <CheckCircle className={`h-4 w-4 ${report.is_published ? "text-green-600" : ""}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No reports generated for {filterForm} - {filterTerm} {filterYear}</p>
            <p className="text-sm mt-1">Click "Generate Reports" to compile results from assessments and exams</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
