import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Mail, MessageSquare, Users as UsersIcon, Calendar, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { StudentOption } from "@/types/school";
import type { QueryData } from "@supabase/supabase-js";

const logsQuery = (teacherId: string) =>
  supabase
    .from("parent_communication_logs")
    .select("*, students(full_name, admission_number)")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
type CommunicationLog = QueryData<ReturnType<typeof logsQuery>>[number];

interface Props {
  userId: string;
  students: StudentOption[];
}

const commTypes = [
  { value: "phone_call", label: "Phone Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "meeting", label: "In-Person Meeting", icon: UsersIcon },
  { value: "message", label: "Message/Note", icon: MessageSquare },
];

export default function ParentCommunicationLog({ userId, students }: Props) {
  const { toast } = useToast();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    student_id: "", parent_name: "", communication_type: "phone_call",
    subject: "", notes: "", follow_up_date: "",
  });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const fetchLogs = useCallback(async () => {
    const { data } = await logsQuery(userId);
    if (data) setLogs(data);
  }, [userId]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleSubmit = async () => {
    if (!form.subject) { toast({ title: "Subject is required", variant: "destructive" }); return; }
    setLoading(true);
    const { error } = await supabase.from("parent_communication_logs").insert({
      teacher_id: userId,
      student_id: form.student_id || null,
      parent_name: form.parent_name || null,
      channel: form.communication_type,
      subject: form.subject,
      message: form.notes || null,
      follow_up_date: form.follow_up_date || null,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Communication logged!" });
      setForm({ student_id: "", parent_name: "", communication_type: "phone_call", subject: "", notes: "", follow_up_date: "" });
      setDialogOpen(false);
      fetchLogs();
    }
    setLoading(false);
  };

  const toggleFollowUp = async (id: string, current: boolean) => {
    await supabase.from("parent_communication_logs").update({ follow_up_completed: !current }).eq("id", id);
    fetchLogs();
  };

  const filtered = logs.filter(l => {
    if (filter === "pending") return l.follow_up_date && !l.follow_up_completed;
    if (filter === "completed") return l.follow_up_completed;
    return true;
  });

  const pendingFollowUps = logs.filter(l => l.follow_up_date && !l.follow_up_completed && new Date(l.follow_up_date) <= new Date()).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold">Parent Communication Log</h2>
          <p className="text-sm text-muted-foreground">Track interactions with parents and guardians.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" /> Log Communication</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-heading">Log Parent Communication</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Student</Label>
                  <Select value={form.student_id} onValueChange={v => setForm(p => ({ ...p, student_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                    <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Parent Name</Label>
                  <Input value={form.parent_name} onChange={e => setForm(p => ({ ...p, parent_name: e.target.value }))} placeholder="Guardian name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={form.communication_type} onValueChange={v => setForm(p => ({ ...p, communication_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{commTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Subject / Reason *</Label><Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="e.g. Academic performance discussion" /></div>
              <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Key points discussed, outcomes, action items..." /></div>
              <div className="space-y-2"><Label>Follow-Up Date (optional)</Label><Input type="date" value={form.follow_up_date} onChange={e => setForm(p => ({ ...p, follow_up_date: e.target.value }))} /></div>
              <Button onClick={handleSubmit} disabled={loading} className="w-full">{loading ? "Saving..." : "Save Log"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold">{logs.length}</p>
          <p className="text-xs text-muted-foreground">Total Interactions</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{pendingFollowUps}</p>
          <p className="text-xs text-muted-foreground">Overdue Follow-Ups</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-500">{logs.filter(l => l.follow_up_completed).length}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </CardContent></Card>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {[["all", "All"], ["pending", "Pending Follow-Ups"], ["completed", "Completed"]].map(([val, label]) => (
          <Button key={val} variant={filter === val ? "default" : "outline"} size="sm" onClick={() => setFilter(val)}>{label}</Button>
        ))}
      </div>

      {/* Log List */}
      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No communication logs yet.</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(log => {
            const typeInfo = commTypes.find(t => t.value === log.channel) || commTypes[0];
            const Icon = typeInfo.icon;
            const isOverdue = log.follow_up_date && !log.follow_up_completed && new Date(log.follow_up_date) <= new Date();
            return (
              <Card key={log.id} className={isOverdue ? "border-orange-300" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2 shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold">{log.subject}</h3>
                        <Badge variant="outline" className="text-[10px]">{typeInfo.label}</Badge>
                        {isOverdue && <Badge variant="destructive" className="text-[10px]">Overdue</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {log.students?.full_name ? `${log.students.full_name} · ` : ""}
                        {log.parent_name ? `${log.parent_name} · ` : ""}
                        {new Date(log.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {log.message && <p className="text-xs text-muted-foreground mt-1">{log.message}</p>}
                      {log.follow_up_date && (
                        <div className="flex items-center gap-2 mt-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Follow-up: {new Date(log.follow_up_date).toLocaleDateString()}</span>
                          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => toggleFollowUp(log.id, log.follow_up_completed)}>
                            {log.follow_up_completed ? (
                              <><CheckCircle2 className="h-3.5 w-3.5 text-green-500 mr-1" /> Done</>
                            ) : (
                              <><AlertCircle className="h-3.5 w-3.5 text-orange-500 mr-1" /> Mark Done</>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
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
