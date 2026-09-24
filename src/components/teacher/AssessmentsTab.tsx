import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Upload,
  Eye,
  Trash2,
  ChevronRight,
  ChevronLeft,
  FileText,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { QueryData } from "@supabase/supabase-js";

const submissionsQuery = (assessmentId: string) =>
  supabase.from("assessment_submissions").select("*, students(full_name, admission_number)").eq("assessment_id", assessmentId);
const resultsQuery = (assessmentId: string) =>
  supabase.from("assessment_results").select("*, students(full_name, admission_number)").eq("assessment_id", assessmentId);
type Submission = QueryData<ReturnType<typeof submissionsQuery>>[number];
type GradedResult = QueryData<ReturnType<typeof resultsQuery>>[number];
import { format } from "date-fns";
import { Sparkles } from "lucide-react";
import AIAssessmentCreator from "./AIAssessmentCreator";
import { gradeFor } from "@/lib/grading";
import { errorMessage } from "@/lib/errors";
import { openStoredFile } from "@/lib/privateFiles";

const assessmentTypes = ["test", "exam", "assignment", "quiz", "project"];

interface Props {
  userId: string;
  classes: Pick<Tables<"classes">, "id" | "name" | "level">[];
  subjects: Pick<Tables<"subjects">, "id" | "name">[];
  students: Pick<Tables<"students">, "id" | "full_name" | "admission_number" | "form">[];
}

export default function AssessmentsTab({ userId, classes, subjects, students }: Props) {
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<Tables<"assessments">[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [aiCreating, setAiCreating] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState<Tables<"assessments"> | null>(null);
  const [gradingStudentIdx, setGradingStudentIdx] = useState(0);
  const [results, setResults] = useState<GradedResult[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // Create form
  const [form, setForm] = useState({
    title: "", assessment_type: "test", class_id: "", subject_id: "",
    max_marks: "100", due_date: "", instructions: "", is_published: true, link_url: ""
  });
  const [formFile, setFormFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  // Grading form
  const [gradeForm, setGradeForm] = useState({ marks: "", feedback: "" });
  const [gradeLoading, setGradeLoading] = useState(false);

  // Filter
  const [filterClass, setFilterClass] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const fetchAssessments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("assessments")
      .select("*")
      .eq("teacher_id", userId)
      .order("created_at", { ascending: false });
    if (data) setAssessments(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchAssessments(); }, [fetchAssessments]);

  const createAssessment = async () => {
    if (!form.title || !form.class_id || !form.subject_id) {
      toast({ title: "Fill required fields", variant: "destructive" }); return;
    }
    setSubmitting(true);

    let file_url = null;
    if (formFile) {
      const ext = formFile.name.split(".").pop();
      const path = `assessments/${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("school-media").upload(path, formFile);
      if (upErr) { toast({ title: "Upload failed", description: upErr.message, variant: "destructive" }); setSubmitting(false); return; }
      file_url = supabase.storage.from("school-media").getPublicUrl(path).data.publicUrl;
    }

    const { error } = await supabase.from("assessments").insert({
      teacher_id: userId,
      title: form.title,
      assessment_type: form.assessment_type,
      class_id: form.class_id,
      subject_id: form.subject_id,
      max_marks: parseFloat(form.max_marks) || 100,
      due_date: form.due_date || null,
      instructions: form.instructions || null,
      file_url,
      link_url: form.link_url || null,
      is_published: form.is_published,
    });

    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Assessment created!" });
      setForm({ title: "", assessment_type: "test", class_id: "", subject_id: "", max_marks: "100", due_date: "", instructions: "", is_published: true, link_url: "" });
      setFormFile(null);
      setCreating(false);
      fetchAssessments();
    }
    setSubmitting(false);
  };

  const deleteAssessment = async (id: string) => {
    await supabase.from("assessments").delete().eq("id", id);
    setAssessments(prev => prev.filter(a => a.id !== id));
    if (selectedAssessment?.id === id) setSelectedAssessment(null);
    toast({ title: "Assessment deleted" });
  };

  const openAssessmentDetail = async (assessment: Tables<"assessments">) => {
    setSelectedAssessment(assessment);
    setGradingStudentIdx(0);

    // Fetch submissions and results
    const [{ data: subs }, { data: res }] = await Promise.all([
      submissionsQuery(assessment.id),
      resultsQuery(assessment.id),
    ]);
    setSubmissions(subs || []);
    setResults(res || []);
  };

  // Get students for the selected assessment's class
  const classStudents = selectedAssessment
    ? students.filter(s => {
        const cls = classes.find(c => c.id === selectedAssessment.class_id);
        return cls ? s.form === cls.level : false;
      })
    : [];


  const currentStudent = classStudents[gradingStudentIdx];
  const currentResult = currentStudent ? results.find(r => r.student_id === currentStudent.id) : null;
  const currentSubmission = currentStudent ? submissions.find(s => s.student_id === currentStudent.id) : undefined;

  useEffect(() => {
    if (currentResult) {
      setGradeForm({ marks: String(currentResult.mark || ""), feedback: currentResult.feedback || "" });
    } else {
      setGradeForm({ marks: "", feedback: "" });
    }
  }, [gradingStudentIdx, selectedAssessment, results, currentResult]);

  const saveGrade = async () => {
    if (!currentStudent || !selectedAssessment || !gradeForm.marks) return;
    setGradeLoading(true);
    const maxMarks = selectedAssessment.max_marks || 100;
    const marksObtained = parseFloat(gradeForm.marks);
    const pct = (marksObtained / maxMarks) * 100;
    const grade = gradeFor(pct);

    const { error } = currentResult
      ? await supabase.from("assessment_results").update({
          mark: marksObtained, percentage: pct, grade,
          feedback: gradeForm.feedback || null,
          graded_by: userId, graded_date: new Date().toISOString(),
        }).eq("id", currentResult.id)
      : await supabase.from("assessment_results").insert({
          assessment_id: selectedAssessment.id, student_id: currentStudent.id,
          mark: marksObtained, percentage: pct, grade,
          feedback: gradeForm.feedback || null,
          graded_by: userId, graded_date: new Date().toISOString(),
        });
    if (error) {
      // Teachers can only grade students in classes they teach.
      toast({ title: "Grade not saved", description: error.message, variant: "destructive" });
      setGradeLoading(false);
      return;
    }

    // Refresh results
    const { data } = await supabase.from("assessment_results").select("*, students(full_name, admission_number)").eq("assessment_id", selectedAssessment.id);
    if (data) setResults(data);

    toast({ title: `Grade saved: ${grade} (${pct.toFixed(0)}%)` });
    setGradeLoading(false);

    // Auto-advance
    if (gradingStudentIdx < classStudents.length - 1) setGradingStudentIdx(prev => prev + 1);
  };

  const publishResults = async () => {
    if (!selectedAssessment) return;
    await supabase.from("assessment_results").update({ is_published: true }).eq("assessment_id", selectedAssessment.id);
    toast({ title: "Results published! Students can now view their grades." });
    const { data } = await supabase.from("assessment_results").select("*, students(full_name, admission_number)").eq("assessment_id", selectedAssessment.id);
    if (data) setResults(data);
  };

  const filteredAssessments = assessments.filter(a => {
    if (filterClass !== "all" && a.class_id !== filterClass) return false;
    if (filterStatus === "upcoming" && (!a.due_date || new Date(a.due_date) < new Date())) return false;
    if (filterStatus === "past" && a.due_date && new Date(a.due_date) >= new Date()) return false;
    if (filterStatus === "draft" && a.is_published) return false;
    return true;
  });

  const getClassName = (id: string) => classes.find(c => c.id === id)?.name || "";
  const getSubjectName = (id: string) => subjects.find(s => s.id === id)?.name || "";

  if (selectedAssessment) {
    const gradedCount = results.length;
    const totalStudents = classStudents.length;
    const allPublished = results.length > 0 && results.every(r => r.is_published);

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setSelectedAssessment(null)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Assessments
        </Button>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="font-heading">{selectedAssessment.title}</CardTitle>
                <CardDescription>
                  {getClassName(selectedAssessment.class_id)} • {getSubjectName(selectedAssessment.subject_id)} • Max: {selectedAssessment.max_marks} marks
                  {selectedAssessment.due_date && ` • Due: ${format(new Date(selectedAssessment.due_date), "MMM d, yyyy")}`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={selectedAssessment.is_published ? "default" : "secondary"}>
                  {selectedAssessment.is_published ? "Published" : "Draft"}
                </Badge>
                <Badge variant="outline">{selectedAssessment.assessment_type}</Badge>
              </div>
            </div>
          </CardHeader>
          {(selectedAssessment.instructions || selectedAssessment.file_url || selectedAssessment.link_url) && (
            <CardContent className="space-y-3">
              {selectedAssessment.instructions && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedAssessment.instructions}</p>}
              {(selectedAssessment.file_url || selectedAssessment.link_url) && (
                <div className="flex flex-wrap gap-2">
                  {selectedAssessment.file_url && (
                    <a href={selectedAssessment.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                      <FileText className="h-3.5 w-3.5" /> View Attachment
                    </a>
                  )}
                  {selectedAssessment.link_url && (
                    <a href={selectedAssessment.link_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" /> Open Link
                    </a>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Grading Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{gradedCount}/{totalStudents}</p>
            <p className="text-xs text-muted-foreground">Graded</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{submissions.length}</p>
            <p className="text-xs text-muted-foreground">Submissions</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{results.length > 0 ? (results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length).toFixed(0) + "%" : "-"}</p>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent></Card>
        </div>

        <Tabs defaultValue="grade" className="space-y-4">
          <TabsList>
            <TabsTrigger value="grade">Grade Students</TabsTrigger>
            <TabsTrigger value="results">Results Table ({gradedCount})</TabsTrigger>
          </TabsList>

          {/* Inline Grading */}
          <TabsContent value="grade">
            {classStudents.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No students found for this class.</CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Student {gradingStudentIdx + 1} of {classStudents.length}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" disabled={gradingStudentIdx === 0} onClick={() => setGradingStudentIdx(prev => prev - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" disabled={gradingStudentIdx >= classStudents.length - 1} onClick={() => setGradingStudentIdx(prev => prev + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg bg-muted p-3">
                    <p className="font-medium">{currentStudent?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{currentStudent?.admission_number}</p>
                    {currentResult && <Badge className="mt-1" variant="secondary">Previously graded: {currentResult.grade}</Badge>}
                  </div>

                  {/* Check for submission */}
                  {currentSubmission && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-sm font-medium text-primary">📎 Student submitted work</p>
                      {currentSubmission.submission_url && (
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            openStoredFile(currentSubmission.submission_url).catch((err) =>
                              toast({ title: "Couldn't open the submission", description: errorMessage(err), variant: "destructive" }));
                          }}
                          className="text-xs text-primary underline"
                        >View submission</a>
                      )}
                      {currentSubmission.notes && (
                        <p className="text-xs text-muted-foreground mt-1">{currentSubmission.notes}</p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Marks (out of {selectedAssessment.max_marks})</Label>
                      <Input type="number" min="0" max={selectedAssessment.max_marks} value={gradeForm.marks} onChange={e => setGradeForm(p => ({ ...p, marks: e.target.value }))} />
                      {gradeForm.marks && (
                        <p className="text-xs text-muted-foreground">
                          {((parseFloat(gradeForm.marks) / (selectedAssessment.max_marks || 100)) * 100).toFixed(0)}% · Grade: <span className="font-bold text-primary">{gradeFor((parseFloat(gradeForm.marks) / (selectedAssessment.max_marks || 100)) * 100)}</span>
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Feedback</Label>
                      <Textarea rows={3} value={gradeForm.feedback} onChange={e => setGradeForm(p => ({ ...p, feedback: e.target.value }))} placeholder="Optional feedback..." />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveGrade} disabled={gradeLoading || !gradeForm.marks} className="flex-1">
                      {gradeLoading ? "Saving..." : "Save & Next"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Results Table */}
          <TabsContent value="results">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Assessment Results</CardTitle>
                  {results.length > 0 && !allPublished && (
                    <Button size="sm" onClick={publishResults}>
                      <Eye className="mr-1 h-4 w-4" /> Publish All Results
                    </Button>
                  )}
                  {allPublished && <Badge>All Published ✓</Badge>}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No grades entered yet.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Student</th>
                        <th className="px-3 py-2">Marks</th>
                        <th className="px-3 py-2">%</th>
                        <th className="px-3 py-2">Grade</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.map(r => (
                        <tr key={r.id} className="border-b">
                          <td className="px-3 py-2">{r.students?.full_name}</td>
                          <td className="px-3 py-2 text-center font-medium">{r.mark}/{selectedAssessment.max_marks}</td>
                          <td className="px-3 py-2 text-center">{(r.percentage || 0).toFixed(0)}%</td>
                          <td className="px-3 py-2 text-center"><Badge>{r.grade}</Badge></td>
                          <td className="px-3 py-2 text-center">
                            <Badge variant={r.is_published ? "default" : "secondary"}>{r.is_published ? "Published" : "Draft"}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Select value={filterClass} onValueChange={setFilterClass}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-32"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="past">Past</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAiCreating(true)}>
            <Sparkles className="mr-1 h-4 w-4 text-primary" /> Create with AI
          </Button>
          <Button onClick={() => setCreating(true)}><Plus className="mr-1 h-4 w-4" /> Create Assessment</Button>
        </div>
      </div>

      <AIAssessmentCreator
        open={aiCreating}
        onOpenChange={setAiCreating}
        userId={userId}
        classes={classes}
        subjects={subjects}
        onPublished={fetchAssessments}
      />

      {/* Create Dialog */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">Create Assessment</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Mid-term Biology Test" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Type</Label>
                <Select value={form.assessment_type} onValueChange={v => setForm(p => ({ ...p, assessment_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{assessmentTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Max Marks</Label><Input type="number" value={form.max_marks} onChange={e => setForm(p => ({ ...p, max_marks: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Class *</Label>
                <Select value={form.class_id} onValueChange={v => setForm(p => ({ ...p, class_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto" position="popper" sideOffset={4}>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subject *</Label>
                <Select value={form.subject_id} onValueChange={v => setForm(p => ({ ...p, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent className="max-h-60 overflow-y-auto" position="popper" sideOffset={4}>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Instructions</Label><Textarea rows={4} value={form.instructions} onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))} placeholder="Instructions for students..." /></div>
            <div className="space-y-2">
              <Label>Link URL (optional)</Label>
              <div className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Input value={form.link_url} onChange={e => setForm(p => ({ ...p, link_url: e.target.value }))} placeholder="https://docs.google.com/... or any URL" />
              </div>
              <p className="text-xs text-muted-foreground">Paste a link to an online document, video, or resource</p>
            </div>
            <div className="space-y-2">
              <Label>File Attachment (question paper, rubric, scan)</Label>
              <div className="rounded-lg border-2 border-dashed p-3 text-center cursor-pointer hover:border-primary/50 transition-colors" onClick={() => fileRef.current?.click()}>
                <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="text-xs text-muted-foreground mt-1">{formFile ? formFile.name : "Click to attach a document, image, or scan"}</p>
                <p className="text-[10px] text-muted-foreground">PDF, DOCX, images, etc.</p>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp" onChange={e => { if (e.target.files?.[0]) setFormFile(e.target.files[0]); }} />
              {formFile && (
                <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => { setFormFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                  Remove file
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={v => setForm(p => ({ ...p, is_published: v }))} />
              <Label>Publish immediately</Label>
            </div>
            <Button onClick={createAssessment} disabled={submitting} className="w-full">{submitting ? "Creating..." : "Create Assessment"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assessments List */}
      {loading ? (
        <div className="flex justify-center py-8"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>
      ) : filteredAssessments.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">
          No assessments found. Create one to get started!
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredAssessments.map(a => {
            const isPast = a.due_date && new Date(a.due_date) < new Date();
            return (
              <Card key={a.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => openAssessmentDetail(a)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{a.title}</p>
                      <Badge variant={!a.is_published ? "secondary" : isPast ? "destructive" : "default"} className="text-xs">
                        {!a.is_published ? "Draft" : isPast ? "Past" : "Active"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{a.assessment_type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {getClassName(a.class_id)} • {getSubjectName(a.subject_id)}
                      {a.due_date && ` • Due: ${format(new Date(a.due_date), "MMM d, yyyy")}`}
                      {a.max_marks && ` • ${a.max_marks} marks`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={e => { e.stopPropagation(); deleteAssessment(a.id); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
