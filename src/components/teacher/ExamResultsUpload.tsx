import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Save, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { gradeFor, gradeBadgeClass } from "@/lib/grading";

interface Props {
  userId: string;
  classes: Pick<Tables<"classes">, "id" | "name" | "level">[];
  subjects: Pick<Tables<"subjects">, "id" | "name">[];
}

export default function ExamResultsUpload({ userId, classes, subjects }: Props) {
  const { toast } = useToast();

  const [exams, setExams] = useState<Tables<"exams">[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [students, setStudents] = useState<Pick<Tables<"students">, "id" | "full_name" | "admission_number">[]>([]);
  const [markEntries, setMarkEntries] = useState<Record<string, { mark: string; comment: string }>>({});
  const [existingResults, setExistingResults] = useState<Record<string, Tables<"exam_results">>>({});
  const [saving, setSaving] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    const { data } = await supabase
      .from("exams")
      .select("*")
      .order("academic_year", { ascending: false })
      .order("term", { ascending: false });
    setExams(data || []);
  };

  const fetchStudentsForClass = useCallback(async () => {
    setLoadingStudents(true);
    // Get students assigned to this class
    const { data: sc } = await supabase
      .from("student_classes")
      .select("student_id")
      .eq("class_id", selectedClassId);

    if (sc && sc.length > 0) {
      const ids = sc.map((s) => s.student_id);
      const { data: studs } = await supabase
        .from("students")
        .select("id, full_name, admission_number")
        .in("id", ids)
        .eq("status", "active")
        .order("full_name");
      setStudents(studs || []);
    } else {
      // Fallback: get students by form level
      const cls = classes.find((c) => c.id === selectedClassId);
      if (cls?.level) {
        const { data: studs } = await supabase
          .from("students")
          .select("id, full_name, admission_number")
          .eq("form", cls.level)
          .eq("status", "active")
          .order("full_name");
        setStudents(studs || []);
      } else {
        setStudents([]);
      }
    }
    setLoadingStudents(false);
  }, [classes, selectedClassId]);

  const fetchExistingResults = useCallback(async () => {
    const studentIds = students.map((s) => s.id);
    const { data } = await supabase
      .from("exam_results")
      .select("*")
      .eq("exam_id", selectedExamId)
      .eq("subject_id", selectedSubjectId)
      .in("student_id", studentIds);

    const existing: Record<string, Tables<"exam_results">> = {};
    const entries: Record<string, { mark: string; comment: string }> = {};
    
    (data || []).forEach((r) => {
      existing[r.student_id] = r;
      entries[r.student_id] = {
        mark: r.mark?.toString() || "",
        comment: r.comment || "",
      };
    });

    // Initialize empty entries for students without results
    students.forEach((s) => {
      if (!entries[s.id]) {
        entries[s.id] = { mark: "", comment: "" };
      }
    });

    setExistingResults(existing);
    setMarkEntries(entries);
  }, [selectedExamId, selectedSubjectId, students]);

  useEffect(() => {
    if (selectedClassId) fetchStudentsForClass();
  }, [fetchStudentsForClass, selectedClassId]);

  useEffect(() => {
    if (selectedExamId && selectedSubjectId && students.length > 0) {
      fetchExistingResults();
    }
  }, [fetchExistingResults, selectedExamId, selectedSubjectId, students]);

  const handleMarkChange = (studentId: string, field: "mark" | "comment", value: string) => {
    setMarkEntries((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const saveResults = async () => {
    if (!selectedExamId || !selectedSubjectId) {
      toast({ title: "Select exam and subject first", variant: "destructive" });
      return;
    }

    setSaving(true);
    const upserts: TablesInsert<"exam_results">[] = [];
    const errors: string[] = [];

    for (const student of students) {
      const entry = markEntries[student.id];
      if (!entry?.mark) continue;

      const mark = parseInt(entry.mark);
      if (isNaN(mark) || mark < 0 || mark > 100) {
        errors.push(`${student.full_name}: invalid mark`);
        continue;
      }

      const row: TablesInsert<"exam_results"> = {
        exam_id: selectedExamId,
        subject_id: selectedSubjectId,
        student_id: student.id,
        mark,
        grade: gradeFor(mark),
        comment: entry.comment || null,
        uploaded_by: userId,
      };

      // If existing, include id for upsert
      if (existingResults[student.id]) {
        row.id = existingResults[student.id].id;
      }

      upserts.push(row);
    }

    if (errors.length > 0) {
      toast({ title: "Fix errors", description: errors.join(", "), variant: "destructive" });
      setSaving(false);
      return;
    }

    if (upserts.length === 0) {
      toast({ title: "No marks to save", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Split into inserts (new) and updates (existing)
    const toInsert = upserts.filter((r) => !r.id);
    const toUpdate = upserts.filter((r) => r.id);

    let hasError = false;

    if (toInsert.length > 0) {
      const { error } = await supabase.from("exam_results").insert(toInsert);
      if (error) {
        toast({ title: "Error saving new results", description: error.message, variant: "destructive" });
        hasError = true;
      }
    }

    if (toUpdate.length > 0 && !hasError) {
      const { error } = await supabase.from("exam_results").upsert(toUpdate, { onConflict: "id" });
      if (error) {
        toast({ title: "Error updating results", description: error.message, variant: "destructive" });
        hasError = true;
      }
    }

    if (!hasError) {
      toast({ title: `${upserts.length} results saved successfully!` });
      await fetchExistingResults();
    }
    setSaving(false);
  };

  const filledCount = Object.values(markEntries).filter((e) => e.mark).length;
  const selectedExam = exams.find((e) => e.id === selectedExamId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <GraduationCap className="h-5 w-5" /> Upload Exam Results
          </CardTitle>
          <CardDescription>
            Select an exam, your class, and subject to enter marks for each student.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Exam *</Label>
              <Select value={selectedExamId} onValueChange={setSelectedExamId}>
                <SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger>
                <SelectContent>
                  {exams.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.name} — {e.term} {e.academic_year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedExam && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">{selectedExam.exam_type}</Badge>
              <span>{selectedExam.form_level || "All Forms"}</span>
              <span>•</span>
              <span>{selectedExam.is_published ? "Published" : "Draft"}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student marks entry */}
      {loadingStudents ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : selectedClassId && selectedExamId && selectedSubjectId && students.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-heading text-base">
                Students ({filledCount}/{students.length} entered)
              </CardTitle>
              <Button onClick={saveResults} disabled={saving || filledCount === 0}>
                <Save className="mr-1 h-4 w-4" />
                {saving ? "Saving..." : `Save ${filledCount} Results`}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Adm No.</th>
                    <th className="px-3 py-2 text-center w-24">Mark (%)</th>
                    <th className="px-3 py-2 text-center w-16">Grade</th>
                    <th className="px-3 py-2 text-left hidden sm:table-cell">Comment</th>
                    <th className="px-3 py-2 text-center w-10">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, idx) => {
                    const entry = markEntries[s.id] || { mark: "", comment: "" };
                    const mark = parseInt(entry.mark);
                    const grade = !isNaN(mark) ? gradeFor(mark) : "";
                    const isExisting = !!existingResults[s.id];

                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium">{s.full_name}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{s.admission_number}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={entry.mark}
                            onChange={(e) => handleMarkChange(s.id, "mark", e.target.value)}
                            className="h-8 text-center w-20 mx-auto"
                            placeholder="—"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {grade && (
                            <Badge className={`text-xs ${gradeBadgeClass(grade)}`} variant="outline">
                              {grade}
                            </Badge>
                          )}
                        </td>
                        <td className="px-3 py-2 hidden sm:table-cell">
                          <Input
                            value={entry.comment}
                            onChange={(e) => handleMarkChange(s.id, "comment", e.target.value)}
                            className="h-8 text-xs"
                            placeholder="Optional comment"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          {isExisting ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mx-auto" />
                          ) : entry.mark ? (
                            <AlertCircle className="h-4 w-4 text-amber-500 mx-auto" />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : selectedClassId && selectedExamId && selectedSubjectId && students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">No students found in this class.</p>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
