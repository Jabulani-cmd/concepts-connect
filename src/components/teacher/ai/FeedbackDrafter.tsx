import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy, Loader2, MessageSquareQuote, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi, ZIM_SUBJECTS } from "@/lib/teacherAi";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

interface Props {
  students?: { id: string; full_name?: string; name?: string }[];
}

export default function FeedbackDrafter({ students = [] }: Props) {
  const { toast } = useToast();
  const [student, setStudent] = useState("");
  const [assignment, setAssignment] = useState("");
  const [subject, setSubject] = useState("Mathematics");
  const [score, setScore] = useState("");
  const [outOf, setOutOf] = useState("100");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");

  const generate = async () => {
    if (!student.trim() || !score.trim()) {
      toast({ title: "Add the student and their score", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await callTeacherAi<{ comment: string }>("feedback", {
        student, assignment, subject, score, outOf, notes,
      });
      setComment(res.comment || "");
    } catch (e) {
      toast({ title: "Could not draft feedback", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <MessageSquareQuote className="h-5 w-5 text-primary" /> AI-Assisted Feedback Draft
        </CardTitle>
        <CardDescription>Turn a score into a personalised comment you can edit before adding it to the gradebook.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label>Student</Label>
            {students.length > 0 ? (
              <Select value={student} onValueChange={setStudent}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => {
                    const n = s.full_name || s.name || "Student";
                    return <SelectItem key={s.id} value={n}>{n}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            ) : (
              <Input value={student} onChange={(e) => setStudent(e.target.value)} placeholder="Student name" />
            )}
          </div>
          <div className="space-y-1">
            <Label>Subject</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ZIM_SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Assignment</Label>
            <Input value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="e.g. Term 2 algebra test" />
          </div>
          <div className="space-y-1">
            <Label>Score</Label>
            <Input type="number" value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Out of</Label>
            <Input type="number" value={outOf} onChange={(e) => setOutOf(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Your notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Careless with negative signs but strong on graphs" />
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Draft feedback
        </Button>

        {comment && (
          <div className="space-y-2 rounded-md border p-3">
            <Label>Feedback (edit freely)</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} className="min-h-[120px]" />
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(comment); toast({ title: "Copied" }); }}>
              <Copy className="mr-2 h-4 w-4" /> Copy to gradebook
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
