import { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, ClipboardCheck, ListChecks, Loader2, CheckCircle2, XCircle, FileText, RotateCcw } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";

type RubricScore = { criterion: string; score: number; max: number; comment: string };

interface EssayResult {
  mode: "essay";
  grade: number;
  grade_percent: number;
  overall_feedback: string;
  strengths: string[];
  improvements: string[];
  rubric_scores: RubricScore[];
}

interface McqResult {
  mode: "mcq";
  score: number;
  correctCount: number;
  total: number;
  breakdown: { index: number; expected: string; given: string; correct: boolean }[];
  feedback: string;
}

interface Submission {
  id: string;
  studentName: string;
  type: "essay" | "mcq";
  subject: string;
  aiGrade: number;
  teacherGrade: number | null;
  approved: boolean;
  createdAt: string;
  result: EssayResult | McqResult;
}

const SAMPLE_PENDING: Submission[] = [
  {
    id: "s1",
    studentName: "Tafadzwa Ncube, Form 4B",
    type: "essay",
    subject: "English Literature",
    aiGrade: 72,
    teacherGrade: null,
    approved: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    result: {
      mode: "essay",
      grade: 72,
      grade_percent: 72,
      overall_feedback:
        "A strong response showing clear understanding of the theme. Could deepen analysis of imagery in the second stanza.",
      strengths: ["Clear thesis statement", "Good use of textual evidence"],
      improvements: ["Vary sentence length", "Explore poetic devices in more depth"],
      rubric_scores: [
        { criterion: "Relevance", score: 18, max: 20, comment: "Stays on topic throughout." },
        { criterion: "Structure", score: 16, max: 20, comment: "Logical flow, weak conclusion." },
        { criterion: "Language", score: 20, max: 30, comment: "Mostly accurate; some repetition." },
        { criterion: "Analysis", score: 18, max: 30, comment: "Surface-level in places." },
      ],
    },
  },
  {
    id: "s2",
    studentName: "Rumbidzai Sibanda, Form 3A",
    type: "mcq",
    subject: "Combined Science",
    aiGrade: 80,
    teacherGrade: 80,
    approved: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    result: {
      mode: "mcq",
      score: 80,
      correctCount: 8,
      total: 10,
      feedback: "Scored 8 out of 10 (80%).",
      breakdown: [],
    },
  },
];

export default function AIShadowMarker() {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<Submission[]>(SAMPLE_PENDING);

  // Essay state
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayStudent, setEssayStudent] = useState("");
  const [essaySubject, setEssaySubject] = useState("");
  const [essayQuestion, setEssayQuestion] = useState("");
  const [essayRubric, setEssayRubric] = useState("");
  const [essayAnswer, setEssayAnswer] = useState("");
  const [essayResult, setEssayResult] = useState<EssayResult | null>(null);

  // MCQ state
  const [mcqLoading, setMcqLoading] = useState(false);
  const [mcqStudent, setMcqStudent] = useState("");
  const [mcqSubject, setMcqSubject] = useState("");
  const [mcqKey, setMcqKey] = useState("A,B,C,D,A,B,C,D,A,B");
  const [mcqAnswers, setMcqAnswers] = useState("A,B,C,A,A,B,D,D,A,B");
  const [mcqResult, setMcqResult] = useState<McqResult | null>(null);

  async function gradeEssay() {
    if (!essayQuestion.trim() || !essayAnswer.trim()) {
      toast({ title: "Missing fields", description: "Question and student answer are required.", variant: "destructive" });
      return;
    }
    setEssayLoading(true);
    setEssayResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-shadow-marker", {
        body: {
          mode: "essay",
          question: essayQuestion,
          rubric: essayRubric || undefined,
          answer: essayAnswer,
          maxMarks: 100,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEssayResult(data as EssayResult);
      addSubmission({
        studentName: essayStudent || "Unnamed student",
        type: "essay",
        subject: essaySubject || "Unspecified",
        aiGrade: data.grade,
        result: data,
      });
      toast({ title: "Graded by AI", description: `${data.grade}/100. Review and approve below.` });
    } catch (e) {
      toast({ title: "Grading failed", description: errorMessage(e, "Please try again."), variant: "destructive" });
    } finally {
      setEssayLoading(false);
    }
  }

  async function gradeMcq() {
    const key = mcqKey.split(",").map((s) => s.trim()).filter(Boolean);
    const ans = mcqAnswers.split(",").map((s) => s.trim());
    if (!key.length) {
      toast({ title: "Missing answer key", variant: "destructive" });
      return;
    }
    setMcqLoading(true);
    setMcqResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-shadow-marker", {
        body: { mode: "mcq", answerKey: key, studentAnswers: ans },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMcqResult(data as McqResult);
      addSubmission({
        studentName: mcqStudent || "Unnamed student",
        type: "mcq",
        subject: mcqSubject || "Unspecified",
        aiGrade: data.score,
        result: data,
      });
      toast({ title: "Marked", description: `${data.correctCount}/${data.total} correct.` });
    } catch (e) {
      toast({ title: "Marking failed", description: errorMessage(e, "Please try again."), variant: "destructive" });
    } finally {
      setMcqLoading(false);
    }
  }

  function addSubmission(input: { studentName: string; type: "essay" | "mcq"; subject: string; aiGrade: number; result: EssayResult | McqResult }) {
    const sub: Submission = {
      id: crypto.randomUUID(),
      studentName: input.studentName,
      type: input.type,
      subject: input.subject,
      aiGrade: input.aiGrade,
      teacherGrade: null,
      approved: false,
      createdAt: new Date().toISOString(),
      result: input.result,
    };
    setSubmissions((prev) => [sub, ...prev]);
  }

  function approve(id: string, grade?: number) {
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, approved: true, teacherGrade: grade ?? s.aiGrade } : s)),
    );
    toast({ title: "Approved", description: "Grade saved to gradebook (demo)." });
  }

  return (
    <Layout>
      <section className="border-b bg-gradient-to-br from-primary/5 via-background to-secondary/5 py-10">
        <div className="container">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AI Shadow Marker</span>
                <Badge variant="secondary" className="ml-2">Demo: real Gemini calls</Badge>
              </div>
              <h1 className="mt-3 font-heading text-3xl font-bold text-foreground md:text-4xl">
                Automated & AI-assisted marking
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Grade multiple-choice tests instantly and use AI to draft a first-pass mark and feedback on essay answers. You stay in control: review, adjust, and approve.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container py-10">
        <Tabs defaultValue="essay" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="essay"><FileText className="mr-2 h-4 w-4" />Essay / Short answer</TabsTrigger>
            <TabsTrigger value="mcq"><ListChecks className="mr-2 h-4 w-4" />MCQ auto-grade</TabsTrigger>
            <TabsTrigger value="pending"><ClipboardCheck className="mr-2 h-4 w-4" />Pending review ({submissions.filter((s) => !s.approved).length})</TabsTrigger>
          </TabsList>

          {/* ESSAY */}
          <TabsContent value="essay" className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Submit an essay for AI marking</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="es">Student</Label>
                    <Input id="es" value={essayStudent} onChange={(e) => setEssayStudent(e.target.value)} placeholder="e.g. Tafadzwa Ncube, 4B" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="esubj">Subject</Label>
                    <Input id="esubj" value={essaySubject} onChange={(e) => setEssaySubject(e.target.value)} placeholder="e.g. English Literature" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="eq">Question prompt *</Label>
                  <Textarea id="eq" rows={2} value={essayQuestion} onChange={(e) => setEssayQuestion(e.target.value)} placeholder='e.g. "Discuss how the poet uses imagery to convey loss."' />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="er">Marking rubric (optional)</Label>
                  <Textarea id="er" rows={2} value={essayRubric} onChange={(e) => setEssayRubric(e.target.value)} placeholder="Leave blank to use defaults (relevance, structure, language, analysis)." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ea">Student answer *</Label>
                  <Textarea id="ea" rows={9} value={essayAnswer} onChange={(e) => setEssayAnswer(e.target.value)} placeholder="Paste the student's response here..." />
                </div>
                <div className="flex items-center gap-3">
                  <Button onClick={gradeEssay} disabled={essayLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {essayLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Marking…</>) : (<><Sparkles className="mr-2 h-4 w-4" />Mark with AI</>)}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => { setEssayAnswer(""); setEssayQuestion(""); setEssayRubric(""); setEssayResult(null); }}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />Clear
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              {essayResult ? (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="font-heading text-lg">AI Grade</CardTitle>
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                          {essayResult.grade}/100
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <Progress value={essayResult.grade_percent} />
                      <p className="text-sm leading-relaxed text-muted-foreground">{essayResult.overall_feedback}</p>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Strengths</h4>
                        <ul className="space-y-1 text-sm">
                          {essayResult.strengths.map((s, i) => (
                            <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{s}</span></li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Areas to improve</h4>
                        <ul className="space-y-1 text-sm">
                          {essayResult.improvements.map((s, i) => (
                            <li key={i} className="flex gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><span>{s}</span></li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-2 border-t pt-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-primary">Rubric breakdown</h4>
                        {essayResult.rubric_scores.map((r, i) => (
                          <div key={i} className="rounded-md bg-muted/40 p-3 text-sm">
                            <div className="flex justify-between font-medium"><span>{r.criterion}</span><span>{r.score}/{r.max}</span></div>
                            <p className="mt-1 text-xs text-muted-foreground">{r.comment}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex h-full flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Sparkles className="mb-3 h-8 w-8 opacity-40" />
                    <p className="text-sm">AI grade and feedback will appear here.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* MCQ */}
          <TabsContent value="mcq" className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="font-heading text-lg">Auto-grade a multiple-choice paper</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="ms">Student</Label>
                    <Input id="ms" value={mcqStudent} onChange={(e) => setMcqStudent(e.target.value)} placeholder="e.g. Rumbidzai Sibanda, 3A" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="msubj">Subject</Label>
                    <Input id="msubj" value={mcqSubject} onChange={(e) => setMcqSubject(e.target.value)} placeholder="e.g. Combined Science" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mk">Answer key (comma-separated)</Label>
                  <Input id="mk" value={mcqKey} onChange={(e) => setMcqKey(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ma">Student answers (comma-separated)</Label>
                  <Input id="ma" value={mcqAnswers} onChange={(e) => setMcqAnswers(e.target.value)} />
                </div>
                <Button onClick={gradeMcq} disabled={mcqLoading} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {mcqLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Marking…</>) : (<><ListChecks className="mr-2 h-4 w-4" />Auto-grade</>)}
                </Button>
              </CardContent>
            </Card>

            <div className="lg:col-span-2">
              {mcqResult ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-heading text-lg">Result</CardTitle>
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/15">{mcqResult.score}%</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Progress value={mcqResult.score} />
                    <p className="text-sm text-muted-foreground">{mcqResult.feedback}</p>
                    <div className="grid grid-cols-2 gap-2 pt-2 text-sm">
                      {mcqResult.breakdown.map((b) => (
                        <div
                          key={b.index}
                          className={`flex items-center justify-between rounded-md border p-2 ${b.correct ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}
                        >
                          <span className="font-medium">Q{b.index}</span>
                          <span className="text-xs">
                            {b.given || "-"} {b.correct ? "✓" : `(× ${b.expected})`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="flex h-full flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <ListChecks className="mb-3 h-8 w-8 opacity-40" />
                    <p className="text-sm">Result breakdown will appear here.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* PENDING */}
          <TabsContent value="pending" className="space-y-4">
            {submissions.length === 0 && (
              <Card className="border-dashed"><CardContent className="py-12 text-center text-muted-foreground">No submissions yet.</CardContent></Card>
            )}
            {submissions.map((s) => (
              <Card key={s.id}>
                <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-heading font-semibold text-foreground">{s.studentName}</h4>
                      <Badge variant="outline" className="text-xs">{s.type.toUpperCase()}</Badge>
                      <span className="text-xs text-muted-foreground">{s.subject}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">AI</div>
                      <div className="font-heading text-xl font-bold text-primary">{s.aiGrade}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs uppercase tracking-wider text-muted-foreground">Teacher</div>
                      <div className="font-heading text-xl font-bold text-foreground">{s.teacherGrade ?? "-"}</div>
                    </div>
                    {s.approved ? (
                      <Badge className="bg-primary/15 text-primary hover:bg-primary/20"><CheckCircle2 className="mr-1 h-3 w-3" />Approved</Badge>
                    ) : (
                      <Button size="sm" onClick={() => approve(s.id)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        Approve {s.aiGrade}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </section>
    </Layout>
  );
}
