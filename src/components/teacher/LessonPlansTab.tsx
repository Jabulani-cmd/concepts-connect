import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit2, Trash2, Eye, Copy, BookOpen, Download, Printer, Sparkles, Loader2 } from "lucide-react";
import { printLessonPlan, downloadLessonPlan, type LessonPlanPrintData } from "@/lib/lesson-plan-print";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  userId: string;
  classes: any[];
  subjects: any[];
}

const emptyForm = {
  subject_id: "", class_id: "", title: "", date: new Date().toISOString().split("T")[0],
  duration_minutes: "40", objectives: "", materials_needed: "", introduction: "",
  main_activity: "", conclusion: "", assessment_strategy: "", homework_notes: "", reflection: "", status: "draft",
};

export default function LessonPlansTab({ userId, classes, subjects }: Props) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [editing, setEditing] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewPlan, setViewPlan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState({ subject: "all", status: "all" });

  // AI generation state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState("");
  const [aiSubjectId, setAiSubjectId] = useState("");
  const [aiClassId, setAiClassId] = useState("");
  const [aiDuration, setAiDuration] = useState("40");
  const [aiGenerating, setAiGenerating] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from("lesson_plans")
      .select("*, subjects(name), classes(name, level)")
      .eq("teacher_id", userId)
      .order("date", { ascending: false });
    if (data) setPlans(data);
  };

  const handleSubmit = async () => {
    if (!form.title || !form.date) {
      toast({ title: "Title and date are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    const payload = {
      teacher_id: userId,
      subject_id: form.subject_id || null,
      class_id: form.class_id || null,
      title: form.title,
      date: form.date,
      duration_minutes: parseInt(form.duration_minutes) || 40,
      objectives: form.objectives || null,
      materials_needed: form.materials_needed || null,
      introduction: form.introduction || null,
      main_activity: form.main_activity || null,
      conclusion: form.conclusion || null,
      assessment_strategy: form.assessment_strategy || null,
      homework_notes: form.homework_notes || null,
      reflection: form.reflection || null,
      status: form.status,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("lesson_plans").update(payload).eq("id", editing));
    } else {
      ({ error } = await supabase.from("lesson_plans").insert(payload));
    }

    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: editing ? "Lesson plan updated!" : "Lesson plan created!" });
      setForm({ ...emptyForm });
      setEditing(null);
      setDialogOpen(false);
      fetchPlans();
    }
    setLoading(false);
  };

  const handleEdit = (plan: any) => {
    setForm({
      subject_id: plan.subject_id || "",
      class_id: plan.class_id || "",
      title: plan.title,
      date: plan.date,
      duration_minutes: String(plan.duration_minutes || 40),
      objectives: plan.objectives || "",
      materials_needed: plan.materials_needed || "",
      introduction: plan.introduction || "",
      main_activity: plan.main_activity || "",
      conclusion: plan.conclusion || "",
      assessment_strategy: plan.assessment_strategy || "",
      homework_notes: plan.homework_notes || "",
      reflection: plan.reflection || "",
      status: plan.status || "draft",
    });
    setEditing(plan.id);
    setDialogOpen(true);
  };

  const handleDuplicate = (plan: any) => {
    setForm({
      subject_id: plan.subject_id || "",
      class_id: plan.class_id || "",
      title: plan.title + " (Copy)",
      date: new Date().toISOString().split("T")[0],
      duration_minutes: String(plan.duration_minutes || 40),
      objectives: plan.objectives || "",
      materials_needed: plan.materials_needed || "",
      introduction: plan.introduction || "",
      main_activity: plan.main_activity || "",
      conclusion: plan.conclusion || "",
      assessment_strategy: plan.assessment_strategy || "",
      homework_notes: plan.homework_notes || "",
      reflection: plan.reflection || "",
      status: "draft",
    });
    setEditing(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("lesson_plans").delete().eq("id", id);
    toast({ title: "Lesson plan deleted" });
    fetchPlans();
  };

  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      toast({ title: "Please enter a topic for the lesson", variant: "destructive" });
      return;
    }

    setAiGenerating(true);
    try {
      const selectedSubject = subjects.find(s => s.id === aiSubjectId);
      const selectedClass = classes.find(c => c.id === aiClassId);

      const { data, error } = await supabase.functions.invoke("generate-lesson-plan", {
        body: {
          topic: aiTopic.trim(),
          subject: selectedSubject?.name || "",
          className: selectedClass?.name || "",
          formLevel: selectedClass?.level || "",
          duration_minutes: parseInt(aiDuration) || 40,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const lp = data.lessonPlan;

      // Pre-fill the form with AI-generated content
      setForm({
        subject_id: aiSubjectId,
        class_id: aiClassId,
        title: lp.title || aiTopic,
        date: new Date().toISOString().split("T")[0],
        duration_minutes: aiDuration,
        objectives: lp.objectives || "",
        materials_needed: lp.materials_needed || "",
        introduction: lp.introduction || "",
        main_activity: lp.main_activity || "",
        conclusion: lp.conclusion || "",
        assessment_strategy: lp.assessment_strategy || "",
        homework_notes: lp.homework_notes || "",
        reflection: "",
        status: "draft",
      });

      setAiDialogOpen(false);
      setEditing(null);
      setDialogOpen(true);

      toast({ title: "AI lesson plan generated!", description: "Review and edit before saving." });
    } catch (err: any) {
      console.error("AI generation error:", err);
      toast({
        title: "Failed to generate lesson plan",
        description: err.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const toPrintData = (p: any): LessonPlanPrintData => ({
    title: p.title, date: p.date, duration_minutes: p.duration_minutes,
    subjectName: p.subjects?.name, className: p.classes?.name,
    objectives: p.objectives, materials_needed: p.materials_needed,
    introduction: p.introduction, main_activity: p.main_activity,
    conclusion: p.conclusion, assessment_strategy: p.assessment_strategy,
    homework_notes: p.homework_notes, reflection: p.reflection, status: p.status,
  });

  const filtered = plans.filter(p => {
    if (filter.subject !== "all" && p.subject_id !== filter.subject) return false;
    if (filter.status !== "all" && p.status !== filter.status) return false;
    return true;
  });

  const statusColor = (s: string) => s === "completed" ? "default" : s === "in_progress" ? "secondary" : "outline";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Lesson Plans</h2>
          <p className="text-sm text-muted-foreground">Create and manage your lesson plans with structured templates.</p>
        </div>
        <div className="flex gap-2">
          {/* AI Generate Button */}
          <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/30 bg-primary/5 hover:bg-primary/10">
                <Sparkles className="mr-1 h-4 w-4 text-primary" /> AI Generate
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="font-heading flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> AI Lesson Plan Generator
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Describe the topic you want to teach and AI will generate a complete lesson plan for you to review and customise.
                </p>
                <div className="space-y-2">
                  <Label>Topic / Lesson Description *</Label>
                  <Textarea
                    rows={3}
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder="e.g. Introduction to quadratic equations, solving by factoring and using the quadratic formula"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={aiSubjectId} onValueChange={setAiSubjectId}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={aiClassId} onValueChange={setAiClassId}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Duration (min)</Label>
                  <Input type="number" value={aiDuration} onChange={e => setAiDuration(e.target.value)} />
                </div>
                <Button onClick={handleAiGenerate} disabled={aiGenerating} className="w-full">
                  {aiGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Lesson Plan...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" /> Generate Lesson Plan
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Manual Create Button */}
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setForm({ ...emptyForm }); } }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 h-4 w-4" /> New Lesson Plan</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-heading">{editing ? "Edit Lesson Plan" : "Create Lesson Plan"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Introduction to Quadratic Equations" />
                  </div>
                  <div className="space-y-2">
                    <Label>Date *</Label>
                    <Input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Select value={form.subject_id} onValueChange={v => setForm(p => ({ ...p, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Class</Label>
                    <Select value={form.class_id} onValueChange={v => setForm(p => ({ ...p, class_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (min)</Label>
                    <Input type="number" value={form.duration_minutes} onChange={e => setForm(p => ({ ...p, duration_minutes: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Learning Objectives</Label>
                  <Textarea rows={2} value={form.objectives} onChange={e => setForm(p => ({ ...p, objectives: e.target.value }))} placeholder="What should students learn by the end of this lesson?" />
                </div>
                <div className="space-y-2">
                  <Label>Materials Needed</Label>
                  <Input value={form.materials_needed} onChange={e => setForm(p => ({ ...p, materials_needed: e.target.value }))} placeholder="e.g. Textbook Ch. 5, whiteboard markers, graph paper" />
                </div>
                <div className="space-y-2">
                  <Label>Introduction / Warm-Up</Label>
                  <Textarea rows={2} value={form.introduction} onChange={e => setForm(p => ({ ...p, introduction: e.target.value }))} placeholder="How will you introduce the topic and engage students?" />
                </div>
                <div className="space-y-2">
                  <Label>Main Activity / Body</Label>
                  <Textarea rows={3} value={form.main_activity} onChange={e => setForm(p => ({ ...p, main_activity: e.target.value }))} placeholder="Describe the core teaching activities and student tasks." />
                </div>
                <div className="space-y-2">
                  <Label>Conclusion / Wrap-Up</Label>
                  <Textarea rows={2} value={form.conclusion} onChange={e => setForm(p => ({ ...p, conclusion: e.target.value }))} placeholder="How will you summarize and close the lesson?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Assessment Strategy</Label>
                    <Textarea rows={2} value={form.assessment_strategy} onChange={e => setForm(p => ({ ...p, assessment_strategy: e.target.value }))} placeholder="How will you check understanding?" />
                  </div>
                  <div className="space-y-2">
                    <Label>Homework / Follow-Up</Label>
                    <Textarea rows={2} value={form.homework_notes} onChange={e => setForm(p => ({ ...p, homework_notes: e.target.value }))} placeholder="Any assignments or preparation for next class?" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Post-Lesson Reflection</Label>
                  <Textarea rows={2} value={form.reflection} onChange={e => setForm(p => ({ ...p, reflection: e.target.value }))} placeholder="How did the lesson go? What would you change?" />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleSubmit} disabled={loading} className="w-full">
                  {loading ? "Saving..." : editing ? "Update Lesson Plan" : "Create Lesson Plan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={filter.subject} onValueChange={v => setFilter(p => ({ ...p, subject: v }))}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Subjects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filter.status} onValueChange={v => setFilter(p => ({ ...p, status: v }))}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Plan List */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <BookOpen className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No lesson plans yet. Create your first one!</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.subjects?.name || "No subject"} · {p.classes?.name || "No class"} · {new Date(p.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {p.objectives && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">{p.objectives}</p>}
                  </div>
                  <Badge variant={statusColor(p.status)} className="ml-2 text-[10px] shrink-0">
                    {p.status.replace("_", " ")}
                  </Badge>
                </div>
                <div className="flex gap-1 mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setViewPlan(p)}><Eye className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(p)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDuplicate(p)}><Copy className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => downloadLessonPlan(toPrintData(p))}><Download className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => printLessonPlan(toPrintData(p))}><Printer className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewPlan} onOpenChange={() => setViewPlan(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {viewPlan && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading">{viewPlan.title}</DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {viewPlan.subjects?.name} · {viewPlan.classes?.name} · {new Date(viewPlan.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · {viewPlan.duration_minutes} min
                </p>
              </DialogHeader>
              <div className="space-y-4">
                {[
                  ["Learning Objectives", viewPlan.objectives],
                  ["Materials Needed", viewPlan.materials_needed],
                  ["Introduction / Warm-Up", viewPlan.introduction],
                  ["Main Activity", viewPlan.main_activity],
                  ["Conclusion", viewPlan.conclusion],
                  ["Assessment Strategy", viewPlan.assessment_strategy],
                  ["Homework / Follow-Up", viewPlan.homework_notes],
                  ["Reflection", viewPlan.reflection],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label as string}>
                    <h4 className="text-sm font-semibold text-primary">{label}</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words overflow-wrap-anywhere">{value}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => downloadLessonPlan(toPrintData(viewPlan))}>
                  <Download className="h-3.5 w-3.5 mr-1" /> Download
                </Button>
                <Button variant="outline" size="sm" onClick={() => printLessonPlan(toPrintData(viewPlan))}>
                  <Printer className="h-3.5 w-3.5 mr-1" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={() => { handleEdit(viewPlan); setViewPlan(null); }}>
                  <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
