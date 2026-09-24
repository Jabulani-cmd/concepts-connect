import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Loader2, Send, Sparkles, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi } from "@/lib/teacherAi";
import { errorMessage } from "@/lib/errors";

const REASONS = [
  { value: "absence", label: "Absence" },
  { value: "performance concern", label: "Performance concern" },
  { value: "positive update", label: "Positive update" },
  { value: "event reminder", label: "Event reminder" },
];

const LANGS = [
  { value: "en", label: "English" },
  { value: "sn", label: "chiShona" },
  { value: "nd", label: "isiNdebele" },
];

interface Props {
  students?: { id: string; full_name?: string; name?: string }[];
}

export default function ParentMessageDrafter({ students = [] }: Props) {
  const { toast } = useToast();
  const [student, setStudent] = useState("");
  const [reason, setReason] = useState("performance concern");
  const [language, setLanguage] = useState("en");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const generate = async () => {
    if (!student.trim()) {
      toast({ title: "Choose a student first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await callTeacherAi<{ message: string }>("parent_message", { student, reason, language, notes });
      setMessage(res.message || "");
    } catch (e) {
      toast({ title: "Could not draft message", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" /> Draft Message to Parent
        </CardTitle>
        <CardDescription>Short, respectful drafts in English, chiShona or isiNdebele.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
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
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LANGS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Context (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Missed three Maths lessons this week" />
        </div>
        <Button onClick={generate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
          Draft message
        </Button>

        {message && (
          <div className="space-y-2 rounded-md border p-3">
            <Label>Message (edit before sending)</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-[140px]" />
            <div className="flex gap-2">
              <Button size="sm" onClick={() => toast({ title: "Message sent", description: "Demo mode. Nothing leaves this browser." })}>
                <Send className="mr-2 h-4 w-4" /> Send to parent
              </Button>
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(message); toast({ title: "Copied" }); }}>
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
