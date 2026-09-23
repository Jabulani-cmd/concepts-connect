import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, RefreshCw, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  students: any[];
  teacherName?: string;
  triggerLabel?: string;
}

const PURPOSES = [
  { value: "progress_update", label: "Progress Update" },
  { value: "concern", label: "Concern / Issue" },
  { value: "meeting_invite", label: "Meeting Invite" },
  { value: "fee_reminder", label: "Fee Reminder" },
  { value: "general", label: "General" },
];

export default function ParentMessageComposer({ students, teacherName, triggerLabel = "AI Parent Message" }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState<"parent" | "student">("parent");
  const [purpose, setPurpose] = useState<string>("progress_update");
  const [studentId, setStudentId] = useState("");
  const [context, setContext] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [edited, setEdited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [variation, setVariation] = useState(1);
  const [copied, setCopied] = useState(false);

  const student = students.find(s => s.id === studentId);

  const generate = async (nextVariation = 1) => {
    if (!studentId) {
      toast({ title: "Please select a student", variant: "destructive" });
      return;
    }
    setLoading(true);
    setEdited(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-parent-message", {
        body: {
          recipient,
          purpose,
          studentName: student?.first_name ? `${student.first_name} ${student.last_name || ""}`.trim() : (student?.name || "Student"),
          formLevel: student?.form_level || student?.class_name,
          teacherName: teacherName || "Class Teacher",
          context,
          schoolName: "MavingTech Business Solutions",
          variation: nextVariation,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSubject(data.subject || "");
      setMessage(data.message || "");
      setVariation(nextVariation);
      toast({ title: "Draft ready", description: "Edit before sending." });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message || "Try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(`Subject: ${subject}\n\n${message}`);
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
            <Sparkles className="h-5 w-5 text-primary" /> AI Parent / Student Message
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Recipient</Label>
              <Select value={recipient} onValueChange={v => setRecipient(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="parent">Parent / Guardian</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PURPOSES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Student *</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name ? `${s.first_name} ${s.last_name || ""}` : (s.name || s.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Context / details (optional)</Label>
            <Textarea
              rows={3}
              value={context}
              onChange={e => setContext(e.target.value)}
              placeholder="e.g. Missed 3 Math classes this week, midterm score dropped from 75% to 58%. Meeting suggested Friday 2pm."
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={() => generate(1)} disabled={loading} className="flex-1 bg-gradient-to-r from-primary to-accent">
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Drafting...</> : <><Sparkles className="mr-2 h-4 w-4" /> Generate Draft</>}
            </Button>
            {message && (
              <Button variant="outline" onClick={() => generate(variation + 1)} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Regenerate
              </Button>
            )}
          </div>

          {message && (
            <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="bg-gradient-to-r from-primary/20 to-accent/20">
                  <Sparkles className="mr-1 h-3 w-3" /> AI Generated{edited ? " · edited" : ""}
                </Badge>
                <Button type="button" size="sm" variant="ghost" onClick={copyToClipboard}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input value={subject} onChange={e => { setSubject(e.target.value); setEdited(true); }} />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  rows={9}
                  value={message}
                  onChange={e => { setMessage(e.target.value); setEdited(true); }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Edit freely before sending via your usual channel.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
