import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Clock, Upload, Eye, Sparkles, Timer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { QueryData } from "@supabase/supabase-js";
import { parseQuestions, parseQuizResult } from "@/lib/assessments";

const assessmentsQuery = (classId: string) =>
  supabase.from("assessments").select("*, subjects(name), classes(name)").eq("is_published", true).eq("class_id", classId).order("due_date", { ascending: true });
const resultsQuery = (studentId: string) =>
  supabase.from("assessment_results").select("*, assessments(title, max_marks, subjects(name), questions)").eq("student_id", studentId).eq("is_published", true);
type Assessment = QueryData<ReturnType<typeof assessmentsQuery>>[number];
type Result = QueryData<ReturnType<typeof resultsQuery>>[number];
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays, endOfDay, isBefore } from "date-fns";
import { gradeTextClass } from "@/lib/grading";
import { errorMessage } from "@/lib/errors";
import { uploadPrivateFile } from "@/lib/privateFiles";

interface Props {
  studentId: string | null;
  studentClassId: string | null;
  userId: string;
}

// Treat "due" as end-of-day on the due date, not midnight at the start of it —
// otherwise an assessment due "today" shows as overdue the moment any time
// passes 00:00 on that day.
function isOverdueDate(dueDateStr: string): boolean {
  return isBefore(endOfDay(new Date(dueDateStr)), new Date());
}

export default function StudentAssessmentsTab({ studentId, studentClassId }: Props) {
  const { toast } = useToast();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [submissions, setSubmissions] = useState<Tables<"assessment_submissions">[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<Assessment | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [submitComment, setSubmitComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [submitFile, setSubmitFile] = useState<File | null>(null);

  // Quiz state
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: assess }, { data: subs }, { data: res }] = await Promise.all([
      assessmentsQuery(studentClassId!),
      supabase.from("assessment_submissions").select("*").eq("student_id", studentId!),
      resultsQuery(studentId!),
    ]);
    setAssessments(assess || []);
    setSubmissions(subs || []);
    setResults(res || []);
    setLoading(false);
  }, [studentClassId, studentId]);

  const getSubmission = (id: string) => submissions.find(s => s.assessment_id === id);
  const getResult = (id: string) => results.find(r => r.assessment_id === id);
  const hasQuestions = (a: Assessment) => parseQuestions(a.questions).length > 0;

  const upcoming = assessments.filter(a => a.due_date && !isOverdueDate(a.due_date) && !getResult(a.id) && !getSubmission(a.id));
  const pastDue = assessments.filter(a => a.due_date && isOverdueDate(a.due_date) && !getSubmission(a.id) && !getResult(a.id));
  const completed = assessments.filter(a => getResult(a.id) || getSubmission(a.id));

  const openQuiz = (a: Assessment) => {
    setSelectedAssessment(a);
    setAnswers({});
    setShowQuiz(true);
    if (a.time_limit_minutes) {
      setSecondsLeft(a.time_limit_minutes * 60);
    } else {
      setSecondsLeft(null);
    }
  };

  const submitQuiz = useCallback(async (auto = false) => {
    if (!selectedAssessment || !studentId) return;
    setSubmitting(true);

    // Marked on the server: students never receive the answer key.
    const { data, error } = await supabase.rpc("submit_quiz", {
      _assessment_id: selectedAssessment.id,
      _answers: answers,
    });
    setSubmitting(false);

    if (error) {
      toast({ title: "Submit failed", description: error.message, variant: "destructive" });
      return;
    }

    const result = parseQuizResult(data);
    setShowQuiz(false);
    toast({
      title: auto ? "Time's up — auto submitted!" : "Submitted & auto-marked",
      description: result
        ? `${result.mark}/${result.total} (${result.percentage.toFixed(0)}%) — ${result.grade} · ${result.passed ? "Pass" : "Below pass mark"}`
        : undefined,
    });
    fetchAll();
  }, [answers, fetchAll, selectedAssessment, studentId, toast]);

  useEffect(() => {
    if (studentClassId && studentId) fetchAll();
    else setLoading(false);
  }, [fetchAll, studentClassId, studentId]);

  useEffect(() => {
    // Realtime results — unique topic per mount to avoid re-subscribing a cached channel
    if (!studentId) return;
    const topic = `student-assess-${studentId}-${Math.random().toString(36).slice(2, 10)}`;
    const ch = supabase.channel(topic)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_results", filter: `student_id=eq.${studentId}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "assessments" }, () => fetchAll())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchAll, studentId]);

  useEffect(() => {
    if (!showQuiz || secondsLeft === null) return;
    if (secondsLeft <= 0) { submitQuiz(true); return; }
    timerRef.current = setTimeout(() => setSecondsLeft(s => (s ?? 0) - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [showQuiz, secondsLeft, submitQuiz]);

  const handleFileSubmit = async () => {
    if (!selectedAssessment || !studentId) return;
    setSubmitting(true);
    let fileUrl: string | null = null;
    if (submitFile) {
      // Student work is private: only staff, the student and their parents can open it.
      const safeName = submitFile.name.replace(/[^A-Za-z0-9._-]/g, "_");
      try {
        fileUrl = await uploadPrivateFile(`submissions/${studentId}/${Date.now()}-${safeName}`, submitFile, submitFile.type || undefined);
      } catch (e) {
        toast({ title: "Upload failed", description: errorMessage(e), variant: "destructive" });
        setSubmitting(false);
        return;
      }
    }
    const { error } = await supabase.from("assessment_submissions").insert({
      assessment_id: selectedAssessment.id,
      student_id: studentId,
      submission_url: fileUrl,
      notes: submitComment || null,
      status: "submitted",
      submission_date: new Date().toISOString(),
    });
    if (error) toast({ title: "Error submitting", description: error.message, variant: "destructive" });
    else { toast({ title: "Assignment submitted!" }); setShowSubmit(false); setSubmitComment(""); setSubmitFile(null); fetchAll(); }
    setSubmitting(false);
  };

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (loading) return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>;

  const renderCard = (a: Assessment, showDue = true) => {
    const sub = getSubmission(a.id);
    const res = getResult(a.id);
    // Calendar-day difference (ignores time-of-day) so "due today" reads as 0 days
    // left, not a negative number just because part of the day has passed.
    const daysLeft = a.due_date ? differenceInCalendarDays(new Date(a.due_date), new Date()) : null;
    const isOverdue = a.due_date && isOverdueDate(a.due_date);
    const isQuiz = hasQuestions(a);

    return (
      <Card key={a.id} className={isOverdue && !sub && !res ? "border-destructive/30" : ""}>
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium">{a.title}</p>
                <Badge variant="outline" className="text-[10px]">{a.assessment_type}</Badge>
                {isQuiz && <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30"><Sparkles className="h-2.5 w-2.5 mr-0.5" />AI Quiz</Badge>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{a.subjects?.name}</p>
              {showDue && a.due_date && (
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className={`text-[11px] ${isOverdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                    {isOverdue ? "Overdue" : daysLeft === 0 ? "Due today" : daysLeft === 1 ? "Due tomorrow" : `${daysLeft} days left`} · {format(new Date(a.due_date), "MMM d")}
                  </span>
                  {isQuiz && a.time_limit_minutes && <span className="text-[11px] text-muted-foreground">· {a.time_limit_minutes} min</span>}
                </div>
              )}
              {res && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-sm font-bold ${gradeTextClass(res.grade)}`}>{res.mark}/{a.max_marks} ({res.grade})</span>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1">
              {!sub && !res && isQuiz && (
                <Button size="sm" className="text-xs h-7" onClick={() => openQuiz(a)}>
                  <Sparkles className="h-3 w-3 mr-1" /> Start Quiz
                </Button>
              )}
              {!sub && !res && !isQuiz && a.assessment_type === "assignment" && (
                <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => { setSelectedAssessment(a); setShowSubmit(true); }}>
                  <Upload className="h-3 w-3 mr-1" /> Submit
                </Button>
              )}
              {res && (
                <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => { setSelectedAssessment(a); setShowResult(true); }}>
                  <Eye className="h-3 w-3 mr-1" /> Result
                </Button>
              )}
              {sub && !res && <Badge className="text-[10px] bg-green-100 text-green-700">Submitted</Badge>}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const selectedResult = selectedAssessment ? getResult(selectedAssessment.id) : null;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="upcoming">
        <TabsList className="w-full">
          <TabsTrigger value="upcoming" className="flex-1 text-xs">Upcoming ({upcoming.length})</TabsTrigger>
          <TabsTrigger value="pastdue" className="flex-1 text-xs">Past Due ({pastDue.length})</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 text-xs">Completed ({completed.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming" className="space-y-2 mt-3">
          {upcoming.length === 0 ? <Empty text="No upcoming assessments" /> : upcoming.map(a => renderCard(a))}
        </TabsContent>
        <TabsContent value="pastdue" className="space-y-2 mt-3">
          {pastDue.length === 0 ? <Empty text="No overdue assessments" /> : pastDue.map(a => renderCard(a))}
        </TabsContent>
        <TabsContent value="completed" className="space-y-2 mt-3">
          {completed.length === 0 ? <Empty text="No completed assessments yet" /> : completed.map(a => renderCard(a, false))}
        </TabsContent>
      </Tabs>

      {/* Quiz Dialog */}
      <Dialog open={showQuiz} onOpenChange={(v) => { if (!v && !submitting) { if (!confirm("Exit quiz? Your progress will be lost.")) return; } setShowQuiz(v); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="text-base">{selectedAssessment?.title}</span>
              {secondsLeft !== null && (
                <Badge variant={secondsLeft < 60 ? "destructive" : "outline"} className="ml-2">
                  <Timer className="h-3 w-3 mr-1" /> {fmtTime(secondsLeft)}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedAssessment?.instructions && (
            <p className="text-xs text-muted-foreground bg-muted p-2 rounded">{selectedAssessment.instructions}</p>
          )}
          <div className="space-y-4">
            {parseQuestions(selectedAssessment?.questions).map((q, i) => (
              <Card key={q.id}>
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-medium">Q{i + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <button
                        key={oi}
                        onClick={() => setAnswers(a => ({ ...a, [q.id]: oi }))}
                        className={`w-full text-left p-2.5 rounded-lg border text-sm transition-colors ${
                          answers[q.id] === oi ? "border-primary bg-primary/5 font-medium" : "border-muted hover:border-primary/30"
                        }`}
                      >
                        <span className="inline-block w-6 font-medium">{String.fromCharCode(65 + oi)}.</span> {opt}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
            <div className="sticky bottom-0 bg-background pt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Answered {Object.keys(answers).length} / {parseQuestions(selectedAssessment?.questions).length || 0}
              </p>
              <Button onClick={() => submitQuiz(false)} disabled={submitting}>
                {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Marking...</> : "Submit Quiz"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* File Submit */}
      <Dialog open={showSubmit} onOpenChange={setShowSubmit}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-base">Submit: {selectedAssessment?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {selectedAssessment?.instructions && <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">{selectedAssessment.instructions}</p>}
            <div>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3 mr-1" /> {submitFile ? submitFile.name : "Attach File"}
              </Button>
              <input ref={fileRef} type="file" className="hidden" onChange={e => setSubmitFile(e.target.files?.[0] || null)} />
            </div>
            <Textarea placeholder="Add comments (optional)..." value={submitComment} onChange={e => setSubmitComment(e.target.value)} rows={3} />
            <Button onClick={handleFileSubmit} disabled={submitting} className="w-full">{submitting ? "Submitting..." : "Submit Assignment"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Results: {selectedAssessment?.title}</DialogTitle></DialogHeader>
          {selectedResult && (
            <div className="space-y-4">
              <div className="text-center py-4">
                <p className={`text-4xl font-bold ${gradeTextClass(selectedResult.grade)}`}>{selectedResult.grade || "—"}</p>
                <p className="text-lg font-medium mt-1">{selectedResult.mark} / {selectedAssessment?.max_marks}</p>
                <p className="text-sm text-muted-foreground">{selectedResult.percentage?.toFixed(1)}%</p>
              </div>
              {selectedResult.feedback && (
                <div className="bg-muted p-3 rounded-lg">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Feedback</p>
                  <pre className="text-xs whitespace-pre-wrap font-sans">{selectedResult.feedback}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card><CardContent className="py-10 text-center">
      <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{text}</p>
    </CardContent></Card>
  );
}
