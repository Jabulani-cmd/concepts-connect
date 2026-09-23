import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/errors";
import type { StudentOption, SubjectOption } from "@/types/school";
import type { Tables } from "@/integrations/supabase/types";
import { gradeFor } from "@/lib/grading";

interface Props {
  students: StudentOption[];
  marks: Tables<"marks">[];
  subjects: SubjectOption[];
  triggerLabel?: string;
}

const TONES = [
  { value: "encouraging", label: "Encouraging" },
  { value: "neutral", label: "Neutral" },
  { value: "needs_improvement", label: "Needs Improvement" },
];

export default function ReportCardCommentGenerator({ students, marks, subjects, triggerLabel = "AI Report Comment" }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [tone, setTone] = useState("neutral");
  const [attendance, setAttendance] = useState("");
  const [notes, setNotes] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [comment, setComment] = useState("");
  const [edited, setEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const student = students.find(s => s.id === studentId);

  const generate = async () => {
    if (!studentId) {
      toast({ title: "Please select a student", variant: "destructive" });
      return;
    }
    setLoading(true);
    setEdited(false);
    try {
      const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s.name]));
      const grades = marks
        .filter(m => m.student_id === studentId)
        .map(m => ({
          subject: subjectMap[m.subject_id] || "Subject",
          mark: m.mark,
          grade: gradeFor(m.mark),
          comment: m.comment,
        }));

      const { data, error } = await supabase.functions.invoke("ai-report-comment", {
        body: {
          studentName: student?.full_name || "Student",
          formLevel: student?.form ?? undefined,
          term,
          grades,
          attendancePercent: attendance ? Number(attendance) : null,
          teacherNotes: notes,
          tone,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setComment(data.comment || "");
      toast({ title: "AI comment ready", description: "Review and edit before saving." });
    } catch (e) {
      toast({ title: "Generation failed", description: errorMessage(e, "Try again."), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(comment);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-primary/30 bg-gradient-to-r from-primary/5 to-accent/5 hover:from-primary/10">
          <Sparkles className="mr-2 h-4 w-4 text-primary" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> AI Report Card Comment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TONES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term</Label>
              <Select value={term} onValueChange={setTerm}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Term 1">Term 1</SelectItem>
                  <SelectItem value="Term 2">Term 2</SelectItem>
                  <SelectItem value="Term 3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Attendance %</Label>
              <Input type="number" min={0} max={100} value={attendance} onChange={e => setAttendance(e.target.value)} placeholder="e.g. 92" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Additional teacher notes (optional)</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Struggled with algebra mid-term but rallied after extra sessions." />
          </div>

          <Button onClick={generate} disabled={loading} className="w-full bg-gradient-to-r from-primary to-accent">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Comment</>}
          </Button>

          {comment && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-gradient-to-r from-primary/20 to-accent/20">
                    <Sparkles className="mr-1 h-3 w-3" /> AI Generated{edited ? " · edited" : ""}
                  </Badge>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Textarea
                rows={5}
                value={comment}
                onChange={e => { setComment(e.target.value); setEdited(true); }}
              />
              <p className="text-xs text-muted-foreground">Edit freely before pasting into the report card.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
