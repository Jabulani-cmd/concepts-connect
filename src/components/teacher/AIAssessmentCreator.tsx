import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Loader2, RefreshCw, Trash2, Plus, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ClassOption, SubjectOption } from "@/types/school";
import type { QuizQuestion } from "@/lib/assessments";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  classes: ClassOption[];
  subjects: SubjectOption[];
  onPublished: () => void;
}

export default function AIAssessmentCreator({ open, onOpenChange, userId, classes, subjects, onPublished }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"config" | "review">("config");
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const [cfg, setCfg] = useState({
    title: "",
    class_id: "",
    subject_id: "",
    topic: "",
    difficulty: "medium",
    count: 10,
    total_marks: 20,
    time_limit: 30,
    due_date: "",
    pass_mark: 50,
  });
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);

  const subjName = subjects.find(s => s.id === cfg.subject_id)?.name;
  const className = classes.find(c => c.id === cfg.class_id)?.name;

  const generate = async () => {
    if (!cfg.subject_id || !cfg.class_id || !cfg.topic) {
      toast({ title: "Fill subject, class and topic", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-generate-assessment", {
      body: {
        subject: subjName,
        grade: className,
        topic: cfg.topic,
        count: cfg.count,
        difficulty: cfg.difficulty,
        totalMarks: cfg.total_marks,
      },
    });
    setLoading(false);
    if (error || !data?.questions) {
      toast({ title: "AI generation failed", description: error?.message || data?.error, variant: "destructive" });
      return;
    }
    setQuestions(data.questions);
    setStep("review");
  };

  const regenerateOne = async (idx: number) => {
    setLoading(true);
    const { data } = await supabase.functions.invoke("ai-generate-assessment", {
      body: { subject: subjName, grade: className, topic: cfg.topic, count: 1, difficulty: cfg.difficulty, totalMarks: cfg.total_marks / cfg.count },
    });
    setLoading(false);
    if (data?.questions?.[0]) {
      setQuestions(prev => prev.map((q, i) => i === idx ? { ...data.questions[0], id: q.id, marks: q.marks } : q));
    }
  };

  const updateQ = (i: number, patch: Partial<QuizQuestion>) => setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q));
  const updateOpt = (i: number, oi: number, val: string) => updateQ(i, { options: questions[i].options.map((o: string, j: number) => j === oi ? val : o) });
  const removeQ = (i: number) => setQuestions(prev => prev.filter((_, idx) => idx !== i));
  const addQ = () => setQuestions(prev => [...prev, {
    id: `q${prev.length + 1}`, question: "New question", options: ["", "", "", ""], correct_index: 0, explanation: "", marks: cfg.total_marks / (prev.length + 1)
  }]);

  const publish = async () => {
    if (!cfg.title) { toast({ title: "Add a title", variant: "destructive" }); return; }
    if (questions.length === 0) { toast({ title: "No questions", variant: "destructive" }); return; }
    setPublishing(true);
    const { error } = await supabase.from("assessments").insert({
      teacher_id: userId,
      title: cfg.title,
      assessment_type: "quiz",
      class_id: cfg.class_id,
      subject_id: cfg.subject_id,
      max_marks: cfg.total_marks,
      due_date: cfg.due_date || null,
      instructions: `AI-generated MCQ on ${cfg.topic}. Auto-marked on submission.`,
      is_published: true,
      questions,
      time_limit_minutes: cfg.time_limit || null,
      pass_mark: cfg.pass_mark,
    });
    setPublishing(false);
    if (error) { toast({ title: "Publish failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Published to class!", description: `${questions.length} questions, auto-marked.` });
    onPublished();
    reset();
    onOpenChange(false);
  };

  const reset = () => {
    setStep("config"); setQuestions([]);
    setCfg({ title: "", class_id: "", subject_id: "", topic: "", difficulty: "medium", count: 10, total_marks: 20, time_limit: 30, due_date: "", pass_mark: 50 });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {step === "config" ? "Create Assessment with AI" : "Review AI Questions"}
          </DialogTitle>
        </DialogHeader>

        {step === "config" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Assessment Title *</Label>
              <Input value={cfg.title} onChange={e => setCfg(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Grade 8 Algebra Quick Quiz" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Class *</Label>
                <Select value={cfg.class_id} onValueChange={v => setCfg(p => ({ ...p, class_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subject *</Label>
                <Select value={cfg.subject_id} onValueChange={v => setCfg(p => ({ ...p, subject_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Topic(s) *</Label>
              <Textarea rows={2} value={cfg.topic} onChange={e => setCfg(p => ({ ...p, topic: e.target.value }))} placeholder="e.g. Linear equations, factorisation" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="space-y-2"><Label>Difficulty</Label>
                <Select value={cfg.difficulty} onValueChange={v => setCfg(p => ({ ...p, difficulty: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label># Questions</Label>
                <Input type="number" min={1} max={30} value={cfg.count} onChange={e => setCfg(p => ({ ...p, count: +e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Total Marks</Label>
                <Input type="number" value={cfg.total_marks} onChange={e => setCfg(p => ({ ...p, total_marks: +e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Time Limit (min)</Label>
                <Input type="number" value={cfg.time_limit} onChange={e => setCfg(p => ({ ...p, time_limit: +e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Due Date</Label>
                <Input type="date" value={cfg.due_date} onChange={e => setCfg(p => ({ ...p, due_date: e.target.value }))} />
              </div>
              <div className="space-y-2"><Label>Pass Mark %</Label>
                <Input type="number" value={cfg.pass_mark} onChange={e => setCfg(p => ({ ...p, pass_mark: +e.target.value }))} />
              </div>
            </div>
            <Button onClick={generate} disabled={loading} className="w-full">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating with AI...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Questions</>}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm">
              <p className="font-medium">{cfg.title || "Untitled"}</p>
              <p className="text-xs text-muted-foreground">
                {className} • {subjName} • {questions.length} questions • {cfg.total_marks} marks
              </p>
            </div>
            {questions.map((q, i) => (
              <Card key={i}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">Q{i + 1}</Label>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => regenerateOne(i)} disabled={loading}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeQ(i)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <Textarea rows={2} value={q.question} onChange={e => updateQ(i, { question: e.target.value })} />
                  <div className="space-y-1.5">
                    {q.options.map((opt: string, oi: number) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQ(i, { correct_index: oi })}
                          className={`h-6 w-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${q.correct_index === oi ? "border-green-600 bg-green-50" : "border-muted-foreground/30"}`}
                        >
                          {q.correct_index === oi && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                        </button>
                        <Input value={opt} onChange={e => updateOpt(i, oi, e.target.value)} className="text-sm" />
                      </div>
                    ))}
                  </div>
                  <Textarea rows={1} value={q.explanation} onChange={e => updateQ(i, { explanation: e.target.value })} placeholder="Explanation..." className="text-xs" />
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={addQ} className="w-full"><Plus className="mr-1 h-3 w-3" /> Add question</Button>
            <div className="flex gap-2 sticky bottom-0 bg-background pt-2">
              <Button variant="outline" onClick={() => setStep("config")} className="flex-1">Back</Button>
              <Button onClick={publish} disabled={publishing} className="flex-1">
                {publishing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publishing...</> : "Publish to Class"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
