import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { QueryData } from "@supabase/supabase-js";
import {
  Plus, Trash2, Loader2, UserCheck, CalendarClock, Wand2
} from "lucide-react";

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const timeSlots = [
  { start: "07:30", end: "08:10" },
  { start: "08:10", end: "08:50" },
  { start: "08:50", end: "09:30" },
  { start: "09:50", end: "10:30" },
  { start: "10:30", end: "11:10" },
  { start: "11:10", end: "11:50" },
  { start: "11:50", end: "12:30" },
  { start: "12:30", end: "13:10" },
  { start: "13:50", end: "14:30" },
  { start: "14:30", end: "15:10" },
];

const assignmentsQuery = () =>
  supabase.from("class_subjects").select("*, classes(name, level), subjects(name), staff(full_name)").order("created_at");
const timetableQuery = () =>
  supabase.from("timetable_entries").select("*, classes(name), subjects(name), staff(full_name)").order("day_of_week");
type Assignment = QueryData<ReturnType<typeof assignmentsQuery>>[number];
type TimetableEntry = QueryData<ReturnType<typeof timetableQuery>>[number];
type NewTimetableEntry = Pick<Tables<"timetable_entries">, "class_id" | "subject_id" | "teacher_id" | "day_of_week" | "start_time" | "end_time">;

interface Props {
  classes: Pick<Tables<"classes">, "id" | "name" | "level">[];
  subjects: Pick<Tables<"subjects">, "id" | "name">[];
  staff: Pick<Tables<"staff">, "id" | "full_name" | "role">[];
  onRefresh: () => void;
}

export default function TeacherClassAssignment({ classes, subjects, staff, onRefresh }: Props) {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeacher, setSelectedTeacher] = useState("all");

  // Assign dialog
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignTeacher, setAssignTeacher] = useState("");
  const [assignClass, setAssignClass] = useState("");
  const [assignSubjects, setAssignSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Auto-timetable dialog
  const [autoTTOpen, setAutoTTOpen] = useState(false);
  const [autoTTTeacher, setAutoTTTeacher] = useState("");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    const [{ data: cs }, { data: tt }] = await Promise.all([
      assignmentsQuery(),
      timetableQuery(),
    ]);
    setAssignments(cs || []);
    setTimetableEntries(tt || []);
    setLoading(false);
  }

  const teachers = staff.filter(s => s.role === "Teacher" || s.role === "HOD" || s.role === "teacher" || s.role === "hod" || !s.role);

  const filteredAssignments = selectedTeacher === "all"
    ? assignments
    : assignments.filter(a => a.teacher_id === selectedTeacher);

  const teacherTTEntries = (teacherId: string) =>
    timetableEntries.filter(e => e.teacher_id === teacherId);

  async function handleAssign() {
    if (!assignTeacher || !assignClass || assignSubjects.length === 0) {
      toast({ title: "Select teacher, class, and at least one subject", variant: "destructive" });
      return;
    }
    setSaving(true);

    let successCount = 0;
    let skipCount = 0;

    for (const subjectId of assignSubjects) {
      // Check for existing assignment
      const existing = assignments.find(
        a => a.class_id === assignClass && a.subject_id === subjectId
      );
      if (existing) {
        // Update teacher on existing assignment
        await supabase.from("class_subjects").update({ teacher_id: assignTeacher }).eq("id", existing.id);
        successCount++;
      } else {
        const { error } = await supabase.from("class_subjects").insert({
          class_id: assignClass,
          subject_id: subjectId,
          teacher_id: assignTeacher,
        });
        if (error) {
          skipCount++;
        } else {
          successCount++;
        }
      }
    }

    toast({
      title: `${successCount} subject(s) assigned`,
      description: skipCount > 0 ? `${skipCount} skipped (duplicates)` : undefined,
    });
    setSaving(false);
    setAssignOpen(false);
    setAssignSubjects([]);
    fetchData();
    onRefresh();
  }

  async function removeAssignment(id: string) {
    await supabase.from("class_subjects").delete().eq("id", id);
    toast({ title: "Assignment removed" });
    fetchData();
    onRefresh();
  }

  // Auto-generate timetable from teacher's class_subjects assignments
  async function generateTimetable() {
    if (!autoTTTeacher) return;
    setGenerating(true);

    // Get this teacher's assignments
    const teacherAssignments = assignments.filter(a => a.teacher_id === autoTTTeacher);
    if (teacherAssignments.length === 0) {
      toast({ title: "No class assignments found for this teacher", variant: "destructive" });
      setGenerating(false);
      return;
    }

    // Get existing timetable entries to avoid clashes
    const { data: allTT } = await supabase.from("timetable_entries").select("*");
    const existingEntries: NewTimetableEntry[] = allTT || [];

    // Helper: check if slot is free for teacher and class
    function isSlotFree(day: number, start: string, end: string, classId: string) {
      return !existingEntries.some(e =>
        e.day_of_week === day && e.start_time === start && e.end_time === end &&
        (e.teacher_id === autoTTTeacher || e.class_id === classId)
      );
    }

    // Distribute assignments across the week
    // Each assignment gets ~2 slots per week (typical for secondary school)
    const newEntries: NewTimetableEntry[] = [];
    let slotIdx = 0;

    for (const assignment of teacherAssignments) {
      let slotsAssigned = 0;
      const targetSlots = 2; // 2 periods per subject per class per week

      for (let attempt = 0; attempt < dayNames.length * timeSlots.length && slotsAssigned < targetSlots; attempt++) {
        const dayIdx = (slotIdx + attempt) % dayNames.length;
        const timeIdx = Math.floor((slotIdx + attempt) / dayNames.length) % timeSlots.length;
        const slot = timeSlots[timeIdx];

        if (isSlotFree(dayIdx, slot.start, slot.end, assignment.class_id)) {
          const entry: NewTimetableEntry = {
            class_id: assignment.class_id,
            subject_id: assignment.subject_id,
            teacher_id: autoTTTeacher,
            day_of_week: dayIdx,
            start_time: slot.start,
            end_time: slot.end,
          };
          newEntries.push(entry);
          // Add to existing to prevent self-clashes
          existingEntries.push(entry);
          slotsAssigned++;
        }
      }
      slotIdx += 3; // Offset for next subject to spread across week
    }

    if (newEntries.length === 0) {
      toast({ title: "Could not find free slots", description: "All available slots are occupied", variant: "destructive" });
      setGenerating(false);
      return;
    }

    const { error } = await supabase.from("timetable_entries").insert(newEntries);
    if (error) {
      toast({ title: "Error generating timetable", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: `Timetable generated!`,
        description: `${newEntries.length} periods created across ${teacherAssignments.length} class-subject(s)`,
      });
    }

    setGenerating(false);
    setAutoTTOpen(false);
    fetchData();
    onRefresh();
  }

  // Group assignments by teacher for summary view
  const teacherSummary = teachers.map(t => {
    const ta = assignments.filter(a => a.teacher_id === t.id);
    const tt = timetableEntries.filter(e => e.teacher_id === t.id);
    return { ...t, assignmentCount: ta.length, periodCount: tt.length };
  }).filter(t => t.assignmentCount > 0 || selectedTeacher === "all");

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Teachers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Teachers</SelectItem>
            {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setAutoTTOpen(true); setAutoTTTeacher(""); }}>
            <Wand2 className="mr-1 h-4 w-4" /> Auto-Generate Timetable
          </Button>
          <Button onClick={() => { setAssignOpen(true); setAssignTeacher(""); setAssignClass(""); setAssignSubjects([]); }}
            className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="mr-1 h-4 w-4" /> Assign Teacher
          </Button>
        </div>
      </div>

      {/* Teacher summary cards */}
      {selectedTeacher === "all" && teacherSummary.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teacherSummary.filter(t => t.assignmentCount > 0).map(t => (
            <Card key={t.id} className="cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => setSelectedTeacher(t.id)}>
              <CardContent className="p-4">
                <p className="font-medium text-sm">{t.full_name}</p>
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <UserCheck className="h-3.5 w-3.5" />
                    {t.assignmentCount} class-subject{t.assignmentCount !== 1 ? "s" : ""}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CalendarClock className="h-3.5 w-3.5" />
                    {t.periodCount} period{t.periodCount !== 1 ? "s" : ""}/week
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Assignments table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-heading">
            {selectedTeacher !== "all"
              ? `Assignments: ${teachers.find(t => t.id === selectedTeacher)?.full_name || "Teacher"}`
              : "All Teacher-Class Assignments"}
          </CardTitle>
          <CardDescription>
            Teacher-to-class-subject mappings. These are used to generate timetable entries.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No assignments found. Click "Assign Teacher" to get started.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Teacher</TableHead>
                    <TableHead>Class</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Timetable Periods</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map(a => {
                    const periods = timetableEntries.filter(
                      e => e.teacher_id === a.teacher_id && e.class_id === a.class_id && e.subject_id === a.subject_id
                    );
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{a.staff?.full_name || "-"}</TableCell>
                        <TableCell>{a.classes?.name}</TableCell>
                        <TableCell>{a.subjects?.name}</TableCell>
                        <TableCell>
                          {periods.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {periods.map(p => (
                                <Badge key={p.id} variant="secondary" className="text-[10px]">
                                  {dayNames[p.day_of_week]} {p.start_time}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">None. Use Auto-Generate</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => removeAssignment(a.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected teacher's timetable preview */}
      {selectedTeacher !== "all" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-heading">Weekly Timetable Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {teacherTTEntries(selectedTeacher).length === 0 ? (
              <p className="text-center py-6 text-sm text-muted-foreground">
                No timetable entries yet. Use "Auto-Generate Timetable" to create periods from assignments.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted">
                      <th className="border px-2 py-1.5 text-left">Time</th>
                      {dayNames.map(d => <th key={d} className="border px-2 py-1.5 text-center">{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map(slot => (
                      <tr key={slot.start}>
                        <td className="border px-2 py-1 font-medium whitespace-nowrap">{slot.start}-{slot.end}</td>
                        {dayNames.map((_, di) => {
                          const entry = timetableEntries.find(
                            e => e.teacher_id === selectedTeacher && e.day_of_week === di &&
                              e.start_time === slot.start && e.end_time === slot.end
                          );
                          return (
                            <td key={di} className="border px-1 py-1 text-center">
                              {entry ? (
                                <div>
                                  <p className="font-semibold text-accent">{entry.subjects?.name || "-"}</p>
                                  <p className="text-muted-foreground">{entry.classes?.name}</p>
                                </div>
                              ) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assign Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Assign Teacher to Class</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Teacher *</Label>
              <Select value={assignTeacher} onValueChange={setAssignTeacher}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>
                  {teachers.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={assignClass} onValueChange={v => { setAssignClass(v); setAssignSubjects([]); }}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.level ? ` (${c.level})` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {assignClass && (
              <div className="space-y-2">
                <Label>Subjects * (select multiple)</Label>
                <div className="max-h-48 overflow-y-auto rounded-lg border p-3 space-y-2">
                  {subjects.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={assignSubjects.includes(s.id)}
                        onCheckedChange={(checked) => {
                          setAssignSubjects(prev =>
                            checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                          );
                        }}
                      />
                      <span className="text-sm">{s.name}</span>
                      {assignments.find(a => a.class_id === assignClass && a.subject_id === s.id) && (
                        <Badge variant="secondary" className="text-[10px]">
                          Already: {assignments.find(a => a.class_id === assignClass && a.subject_id === s.id)?.staff?.full_name || "Unassigned"}
                        </Badge>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{assignSubjects.length} selected</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssign} disabled={saving}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Assign {assignSubjects.length > 0 ? `(${assignSubjects.length})` : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Generate Timetable Dialog */}
      <Dialog open={autoTTOpen} onOpenChange={setAutoTTOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-heading">Auto-Generate Timetable</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will automatically create timetable periods for the selected teacher based on their class-subject assignments.
            Each subject gets ~2 periods per week. Existing entries won't be duplicated.
          </p>
          <div className="space-y-2">
            <Label>Select Teacher</Label>
            <Select value={autoTTTeacher} onValueChange={setAutoTTTeacher}>
              <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
              <SelectContent>
                {teachers.filter(t => assignments.some(a => a.teacher_id === t.id)).map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name} ({assignments.filter(a => a.teacher_id === t.id).length} assignments)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {autoTTTeacher && (
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-medium">Will generate periods for:</p>
              {assignments.filter(a => a.teacher_id === autoTTTeacher).map(a => (
                <p key={a.id} className="text-muted-foreground">• {a.classes?.name} · {a.subjects?.name}</p>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoTTOpen(false)}>Cancel</Button>
            <Button onClick={generateTimetable} disabled={generating || !autoTTTeacher}>
              {generating && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              <Wand2 className="mr-1 h-4 w-4" /> Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
