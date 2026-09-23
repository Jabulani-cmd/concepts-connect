import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Calendar, Clock, MapPin, Loader2, Send } from "lucide-react";
import { format } from "date-fns";

interface Subject {
  id: string;
  name: string;
  code: string | null;
}

interface Exam {
  id: string;
  name: string;
  form_level: string;
  term: string;
  academic_year: string;
  is_published: boolean;
  subject_ids: string[] | null;
}

interface ExamTimetableEntry {
  id: string;
  exam_id: string;
  subject_id: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  venue: string | null;
  invigilators: string[] | null;
  notes: string | null;
  subjects?: { name: string; code: string | null };
}

export default function ExamTimetableTab() {
  const { toast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [entries, setEntries] = useState<ExamTimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState("");
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExamTimetableEntry | null>(null);
  const [form, setForm] = useState({
    subject_id: "",
    exam_date: "",
    start_time: "08:00",
    end_time: "10:00",
    venue: "",
    invigilators: "",
    notes: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const [examsRes, subjectsRes] = await Promise.all([
      supabase.from("exams").select("id, name, form_level, term, academic_year, is_published, subject_ids").order("created_at", { ascending: false }),
      supabase.from("subjects").select("id, name, code").order("name")
    ]);
    if (examsRes.data) setExams(examsRes.data);
    if (subjectsRes.data) setSubjects(subjectsRes.data);
    setLoading(false);
  }

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase
      .from("exam_timetable_entries")
      .select("*, subjects(name, code)")
      .eq("exam_id", selectedExam)
      .order("exam_date")
      .order("start_time");
    if (data) setEntries(data);
  }, [selectedExam]);

  useEffect(() => {
    if (selectedExam) fetchEntries();
  }, [fetchEntries, selectedExam]);

  const currentExam = exams.find(e => e.id === selectedExam);
  const examSubjects = currentExam?.subject_ids
    ? subjects.filter(s => currentExam.subject_ids!.includes(s.id))
    : [];

  function openAdd() {
    setEditing(null);
    setForm({ subject_id: "", exam_date: "", start_time: "08:00", end_time: "10:00", venue: "", invigilators: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(entry: ExamTimetableEntry) {
    setEditing(entry);
    setForm({
      subject_id: entry.subject_id,
      exam_date: entry.exam_date,
      start_time: entry.start_time,
      end_time: entry.end_time,
      venue: entry.venue || "",
      invigilators: (entry.invigilators || []).join(", "),
      notes: entry.notes || ""
    });
    setDialogOpen(true);
  }

  async function save() {
    if (!form.subject_id || !form.exam_date || !form.start_time || !form.end_time) {
      toast({ title: "Please fill required fields", variant: "destructive" });
      return;
    }

    const payload = {
      exam_id: selectedExam,
      subject_id: form.subject_id,
      exam_date: form.exam_date,
      start_time: form.start_time,
      end_time: form.end_time,
      venue: form.venue || null,
      invigilators: form.invigilators ? form.invigilators.split(",").map(s => s.trim()).filter(Boolean) : null,
      notes: form.notes || null
    };

    if (editing) {
      const { error } = await supabase.from("exam_timetable_entries").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Entry updated" });
    } else {
      const { error } = await supabase.from("exam_timetable_entries").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Entry added" });
    }
    setDialogOpen(false);
    fetchEntries();
  }

  async function deleteEntry(id: string) {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("exam_timetable_entries").delete().eq("id", id);
    toast({ title: "Entry deleted" });
    fetchEntries();
  }

  async function notifyStudents() {
    if (!currentExam) return;
    if (!confirm(`Send exam timetable notification to all ${currentExam.form_level} students?`)) return;
    
    // Create notification for all students in this form level
    const { data: studentsData } = await supabase
      .from("students")
      .select("user_id")
      .eq("form", currentExam.form_level)
      .eq("status", "active")
      .not("user_id", "is", null);

    if (studentsData && studentsData.length > 0) {
      const notifications = studentsData.map(s => ({
        user_id: s.user_id!,
        title: "Exam Timetable Published",
        message: `The exam timetable for ${currentExam.name} is now available. Check your dashboard for details.`,
        type: "exam_timetable"
      }));
      
      await supabase.from("notifications").insert(notifications);
      toast({ title: "Notifications sent", description: `${studentsData.length} students notified` });
    } else {
      toast({ title: "No students found", description: "No students with linked accounts in this form level", variant: "destructive" });
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
        <div>
          <CardTitle className="font-heading">Exam Timetables</CardTitle>
          <CardDescription>Create and manage exam schedules with dates, times, and venues</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Exam Selector */}
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>Select Exam</Label>
            <Select value={selectedExam} onValueChange={setSelectedExam}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an exam to manage its timetable" />
              </SelectTrigger>
              <SelectContent>
                {exams.map(e => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} ({e.form_level} - {e.term} {e.academic_year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedExam && (
            <div className="flex gap-2">
              <Button onClick={openAdd} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="mr-1 h-4 w-4" /> Add Entry
              </Button>
              <Button onClick={notifyStudents} variant="outline">
                <Send className="mr-1 h-4 w-4" /> Notify Students
              </Button>
            </div>
          )}
        </div>

        {/* Current exam info */}
        {currentExam && (
          <div className="flex items-center gap-2">
            <Badge variant={currentExam.is_published ? "default" : "outline"}>
              {currentExam.is_published ? "Published" : "Draft"}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {examSubjects.length} subject(s) · {entries.length} scheduled
            </span>
          </div>
        )}

        {/* Timetable entries */}
        {selectedExam && entries.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Invigilators</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map(entry => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(entry.exam_date), "EEE, dd MMM yyyy")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        {entry.start_time} - {entry.end_time}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{entry.subjects?.name}</span>
                      {entry.subjects?.code && (
                        <span className="text-muted-foreground text-xs ml-1">({entry.subjects.code})</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {entry.venue ? (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          {entry.venue}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {entry.invigilators?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {entry.invigilators.map((inv, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{inv}</Badge>
                          ))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-xs text-muted-foreground">
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(entry)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteEntry(entry.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : selectedExam ? (
          <p className="text-center py-8 text-muted-foreground">
            No exam schedule entries yet. Click "Add Entry" to create the timetable.
          </p>
        ) : (
          <p className="text-center py-8 text-muted-foreground">
            Select an exam above to view or create its timetable.
          </p>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Schedule Entry" : "Add Schedule Entry"}</DialogTitle>
            <DialogDescription>Define the date, time, and venue for this exam</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Subject *</Label>
              <Select value={form.subject_id} onValueChange={v => setForm(p => ({ ...p, subject_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {examSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} {s.code ? `(${s.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date *</Label>
              <Input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Venue</Label>
              <Input value={form.venue} onChange={e => setForm(p => ({ ...p, venue: e.target.value }))} placeholder="e.g. Main Hall, Room 12" />
            </div>
            <div className="space-y-2">
              <Label>Invigilators (comma-separated)</Label>
              <Input value={form.invigilators} onChange={e => setForm(p => ({ ...p, invigilators: e.target.value }))} placeholder="e.g. Mr. Zulu, Mrs. Khumalo" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} placeholder="Any special instructions..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              {editing ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
