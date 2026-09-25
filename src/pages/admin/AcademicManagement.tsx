import { useState, useEffect, useCallback, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { QueryData } from "@supabase/supabase-js";
import { saveClassAttendance } from "@/lib/attendance";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  Users,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Search,
  Loader2,
  GraduationCap,
  FileText,
  BarChart3,
  CalendarDays,
  ClipboardList,
  UserCheck,
  Trophy,
} from "lucide-react";
import ExamTimetableTab from "@/components/admin/ExamTimetableTab";
import TermReportsTab from "@/components/admin/TermReportsTab";
import TeacherClassAssignment from "@/components/admin/TeacherClassAssignment";
import { errorMessage } from "@/lib/errors";
import { gradeFor, gradeBadgeClass } from "@/lib/grading";
import { DEFAULT_FORM, FORM_LEVELS } from "@/lib/forms";

const termOptions = ["Term 1", "Term 2", "Term 3"];
const streamOptions = ["A", "B", "C", "D"];
const deptOptions = ["Mathematics", "Sciences", "Languages", "Humanities", "Technical", "Arts", "Sports", "Commerce"];
const examTypes = [
  { value: "test", label: "Class Test" },
  { value: "mid_term", label: "Mid-Term" },
  { value: "end_of_term", label: "End of Term" },
  { value: "mock", label: "Mock Exam" },
  { value: "zimsec", label: "ZIMSEC" },
];
const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const timeSlots = [
  { start: "07:30", end: "08:10" },
  { start: "08:10", end: "08:50" },
  { start: "08:50", end: "09:30" },
  { start: "09:30", end: "09:50", isBreak: true, label: "Break" },
  { start: "09:50", end: "10:30" },
  { start: "10:30", end: "11:10" },
  { start: "11:10", end: "11:50" },
  { start: "11:50", end: "12:30" },
  { start: "12:30", end: "13:10" },
  { start: "13:10", end: "13:50", isBreak: true, label: "Lunch" },
  { start: "13:50", end: "14:30" },
  { start: "14:30", end: "15:10" },
  { start: "15:10", end: "15:30", isBreak: true, label: "Break" },
];

const sportsSlots = [
  { start: "15:30", end: "16:10" },
  { start: "16:10", end: "17:00" },
];

const sportsActivityOptions = [
  "Rugby", "Soccer", "Cricket", "Hockey", "Tennis", "Netball", "Basketball",
  "Athletics", "Swimming", "Volleyball", "Chess Club", "Drama Club", "Debate Club",
  "Music Club", "Science Club", "Art Club", "Computer Club", "Scouts", "Cadets",
];

const classesQuery = () => supabase.from("classes").select("*, staff:class_teacher_id(full_name)").order("name");
type ClassesRow = QueryData<ReturnType<typeof classesQuery>>[number];
const subjectsQuery = () => supabase.from("subjects").select("*").order("name");
type SubjectsRow = QueryData<ReturnType<typeof subjectsQuery>>[number];
const staffQuery = () => supabase.from("staff").select("id, full_name, role, subjects_taught").order("full_name");
type StaffRow = QueryData<ReturnType<typeof staffQuery>>[number];
const studentsQuery = () => supabase.from("students").select("id, full_name, admission_number, form, stream").eq("status", "active").order("full_name");
type StudentsRow = QueryData<ReturnType<typeof studentsQuery>>[number];
const timetableQuery = () => supabase.from("timetable_entries").select("*, subjects(name), staff(full_name), classes(name)").order("day_of_week");
type TimetableRow = QueryData<ReturnType<typeof timetableQuery>>[number];
const sportsQuery = () => supabase.from("sports_schedule").select("*, staff:coach_id(full_name), classes(name)").order("day_of_week");
type SportsRow = QueryData<ReturnType<typeof sportsQuery>>[number];
const classSubjectsQuery = () => supabase.from("class_subjects").select("*, classes(name), subjects(name), staff(full_name)").order("created_at");
type ClassSubjectsRow = QueryData<ReturnType<typeof classSubjectsQuery>>[number];
const examsQuery = () => supabase.from("exams").select("*").order("created_at", { ascending: false });
type ExamsRow = QueryData<ReturnType<typeof examsQuery>>[number];
const examResultsQuery = () => supabase.from("exam_results").select("*, students(full_name, admission_number), subjects(name)").order("created_at", { ascending: false });
type ExamResultsRow = QueryData<ReturnType<typeof examResultsQuery>>[number];

export default function AcademicManagement() {
  const { toast } = useToast();
  const { user } = useAuth();

  // ─── State ───
  const [classes, setClasses] = useState<ClassesRow[]>([]);
  const [subjects, setSubjects] = useState<SubjectsRow[]>([]);
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [students, setStudents] = useState<StudentsRow[]>([]);
  const [timetableEntries, setTimetableEntries] = useState<TimetableRow[]>([]);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectsRow[]>([]);
  const [exams, setExams] = useState<ExamsRow[]>([]);
  const [examResults, setExamResults] = useState<ExamResultsRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [classDialogOpen, setClassDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassesRow | null>(null);
  const [classForm, setClassForm] = useState({ name: "", level: DEFAULT_FORM, stream: "", class_teacher_id: "", room: "", capacity: "40" });

  const [subjectDialogOpen, setSubjectDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectsRow | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: "", code: "", department: "", is_examinable: true });

  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignClass, setAssignClass] = useState("");
  const [assignSubject, setAssignSubject] = useState("");
  const [assignTeacher, setAssignTeacher] = useState("");

  const [ttViewClass, setTtViewClass] = useState("");
  const [ttEditCell, setTtEditCell] = useState<{ day: number; slot: typeof timeSlots[0] } | null>(null);
  const [ttSubject, setTtSubject] = useState("");
  const [ttTeacher, setTtTeacher] = useState("");
  const [ttRoom, setTtRoom] = useState("");

  // Sports schedule state
  const [sportsEntries, setSportsEntries] = useState<SportsRow[]>([]);
  const [sportsViewClass, setSportsViewClass] = useState("");
  const [sportsEditCell, setSportsEditCell] = useState<{ day: number; slot: { start: string; end: string } } | null>(null);
  const [sportsActivity, setSportsActivity] = useState("");
  const [sportsVenue, setSportsVenue] = useState("");
  const [sportsCoach, setSportsCoach] = useState("");
  const [sportsType, setSportsType] = useState("sport");

  const [attClass, setAttClass] = useState("");
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [attRecords, setAttRecords] = useState<Record<string, string>>({});
  const [attSaving, setAttSaving] = useState(false);

  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamsRow | null>(null);
  const [examForm, setExamForm] = useState({ name: "", exam_type: "end_of_term", form_level: DEFAULT_FORM, term: "Term 1", academic_year: "2026", start_date: "", end_date: "", subject_ids: [] as string[] });

  const [marksExam, setMarksExam] = useState("");
  const [marksSubject, setMarksSubject] = useState("");
  const [marksEntries, setMarksEntries] = useState<Record<string, string>>({});
  const [marksSaving, setMarksSaving] = useState(false);
  const [resultsSearch, setResultsSearch] = useState("");

  useEffect(() => {
    Promise.all([fetchClasses(), fetchSubjects(), fetchStaff(), fetchStudents(), fetchTimetable(), fetchClassSubjects(), fetchExams(), fetchExamResults(), fetchSportsSchedule()])
      .finally(() => setLoading(false));
  }, []);

  // ═══ FETCH ═══
  async function fetchClasses() {
    const { data } = await classesQuery();
    if (data) setClasses(data);
  }
  async function fetchSubjects() {
    const { data } = await subjectsQuery();
    if (data) setSubjects(data);
  }
  async function fetchStaff() {
    const { data } = await staffQuery();
    if (data) setStaff(data);
  }
  async function fetchStudents() {
    const { data } = await studentsQuery();
    if (data) setStudents(data);
  }
  async function fetchTimetable() {
    const { data } = await timetableQuery();
    if (data) setTimetableEntries(data);
  }
  async function fetchSportsSchedule() {
    const { data } = await sportsQuery();
    if (data) setSportsEntries(data);
  }
  async function fetchClassSubjects() {
    const { data } = await classSubjectsQuery();
    if (data) setClassSubjects(data);
  }
  async function fetchExams() {
    const { data } = await examsQuery();
    if (data) setExams(data);
  }
  async function fetchExamResults() {
    const { data } = await examResultsQuery();
    if (data) setExamResults(data);
  }

  // ═══ CLASS CRUD ═══
  function openAddClass() {
    setEditingClass(null);
    setClassForm({ name: "", level: DEFAULT_FORM, stream: "", class_teacher_id: "", room: "", capacity: "40" });
    setClassDialogOpen(true);
  }
  function openEditClass(c: ClassesRow) {
    setEditingClass(c);
    setClassForm({ name: c.name, level: c.level || DEFAULT_FORM, stream: c.stream || "", class_teacher_id: c.class_teacher_id || "", room: c.room || "", capacity: String(c.capacity || 40) });
    setClassDialogOpen(true);
  }
  async function saveClass() {
    const payload = { name: classForm.name, level: classForm.level, stream: classForm.stream || null, class_teacher_id: classForm.class_teacher_id || null, room: classForm.room || null, capacity: parseInt(classForm.capacity) || 40 };
    if (!payload.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editingClass) {
      const { error } = await supabase.from("classes").update(payload).eq("id", editingClass.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Class updated" });
    } else {
      const { error } = await supabase.from("classes").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Class created" });
    }
    setClassDialogOpen(false);
    fetchClasses();
  }
  async function deleteClass(id: string) {
    if (!confirm("Delete this class? This will permanently remove all linked data (assessments, homework, materials, timetable, enrollments, attendance, and class conversations).")) return;
    try {
      const { error } = await supabase.rpc("delete_class_cascade", { _class_id: id });
      if (error) throw error;

      toast({ title: "Class deleted successfully" });
      fetchClasses();
      fetchTimetable();
      fetchClassSubjects();
    } catch (err) {
      toast({ title: "Failed to delete class", description: errorMessage(err), variant: "destructive" });
    }
  }

  // ═══ SUBJECT CRUD ═══
  function openAddSubject() {
    setEditingSubject(null);
    setSubjectForm({ name: "", code: "", department: "", is_examinable: true });
    setSubjectDialogOpen(true);
  }
  function openEditSubject(s: SubjectsRow) {
    setEditingSubject(s);
    setSubjectForm({ name: s.name, code: s.code || "", department: s.department || "", is_examinable: s.is_examinable ?? true });
    setSubjectDialogOpen(true);
  }
  async function saveSubject() {
    const payload = { name: subjectForm.name, code: subjectForm.code || null, department: subjectForm.department || null, is_examinable: subjectForm.is_examinable };
    if (!payload.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (editingSubject) {
      const { error } = await supabase.from("subjects").update(payload).eq("id", editingSubject.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Subject updated" });
    } else {
      const { error } = await supabase.from("subjects").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Subject created" });
    }
    setSubjectDialogOpen(false);
    fetchSubjects();
  }
  async function deleteSubject(id: string) {
    if (!confirm("Delete this subject?")) return;
    await supabase.from("subjects").delete().eq("id", id);
    toast({ title: "Subject deleted" });
    fetchSubjects();
  }

  // ═══ ASSIGN SUBJECT TO CLASS ═══
  async function assignSubjectToClass() {
    if (!assignClass || !assignSubject) { toast({ title: "Select class and subject", variant: "destructive" }); return; }
    const { error } = await supabase.from("class_subjects").insert({ class_id: assignClass, subject_id: assignSubject, teacher_id: assignTeacher || null });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Subject assigned" });
    setAssignDialogOpen(false);
    fetchClassSubjects();
  }
  async function removeAssignment(id: string) {
    await supabase.from("class_subjects").delete().eq("id", id);
    toast({ title: "Assignment removed" });
    fetchClassSubjects();
  }

  // ═══ TIMETABLE ═══
  const filteredTT = timetableEntries.filter(e => e.class_id === ttViewClass);

  function getTTEntry(day: number, start: string, end: string) {
    return filteredTT.find(e => e.day_of_week === day && e.start_time === start && e.end_time === end);
  }

  async function saveTTEntry() {
    if (!ttEditCell || !ttViewClass) return;
    const existing = getTTEntry(ttEditCell.day, ttEditCell.slot.start, ttEditCell.slot.end);

    // Clash detection
    if (ttTeacher) {
      const { data: teacherClash } = await supabase.from("timetable_entries").select("id, classes(name)")
        .eq("teacher_id", ttTeacher).eq("day_of_week", ttEditCell.day).eq("start_time", ttEditCell.slot.start)
        .neq("class_id", ttViewClass);
      if (teacherClash && teacherClash.length > 0) {
        toast({ title: "Teacher clash!", description: `Teacher is already assigned at this time`, variant: "destructive" });
        return;
      }
    }
    if (ttRoom) {
      const { data: roomClash } = await supabase.from("timetable_entries").select("id, classes(name)")
        .eq("room", ttRoom).eq("day_of_week", ttEditCell.day).eq("start_time", ttEditCell.slot.start)
        .neq("class_id", ttViewClass);
      if (roomClash && roomClash.length > 0) {
        toast({ title: "Room clash!", description: `Room is already booked at this time`, variant: "destructive" });
        return;
      }
    }

    const payload = {
      class_id: ttViewClass, subject_id: ttSubject || null, teacher_id: ttTeacher || null,
      day_of_week: ttEditCell.day, start_time: ttEditCell.slot.start, end_time: ttEditCell.slot.end,
      room: ttRoom || null,
    };

    if (existing) {
      if (!ttSubject) {
        const { error } = await supabase.from("timetable_entries").delete().eq("id", existing.id);
        if (error) { toast({ title: "Error deleting entry", description: error.message, variant: "destructive" }); return; }
      } else {
        const { error } = await supabase.from("timetable_entries").update(payload).eq("id", existing.id);
        if (error) { toast({ title: "Error updating entry", description: error.message, variant: "destructive" }); return; }
      }
    } else if (ttSubject) {
      const { error } = await supabase.from("timetable_entries").insert(payload);
      if (error) { toast({ title: "Error saving entry", description: error.message, variant: "destructive" }); return; }
    }

    toast({ title: "Timetable updated" });
    setTtEditCell(null);
    fetchTimetable();
  }

  // ═══ SPORTS SCHEDULE ═══
  const filteredSports = sportsEntries.filter(e => e.class_id === sportsViewClass);

  function getSportsEntry(day: number, start: string, end: string) {
    return filteredSports.find(e => e.day_of_week === day && e.start_time === start && e.end_time === end);
  }

  async function saveSportsEntry() {
    if (!sportsEditCell || !sportsViewClass) return;
    const existing = getSportsEntry(sportsEditCell.day, sportsEditCell.slot.start, sportsEditCell.slot.end);

    const payload = {
      class_id: sportsViewClass, sport: sportsActivity, activity_name: sportsActivity, activity_type: sportsType,
      day_of_week: sportsEditCell.day, start_time: sportsEditCell.slot.start, end_time: sportsEditCell.slot.end,
      venue: sportsVenue || null, coach_id: sportsCoach || null,
    };

    if (existing) {
      if (!sportsActivity) {
        const { error } = await supabase.from("sports_schedule").delete().eq("id", existing.id);
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      } else {
        const { error } = await supabase.from("sports_schedule").update(payload).eq("id", existing.id);
        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      }
    } else if (sportsActivity) {
      const { error } = await supabase.from("sports_schedule").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }

    toast({ title: "Sports schedule updated" });
    setSportsEditCell(null);
    fetchSportsSchedule();
  }

  const attStudents = useMemo(() => {
    const cls = classes.find(c => c.id === attClass);
    return cls ? students.filter(s => s.form === cls.level && (!cls.stream || s.stream === cls.stream)) : [];
  }, [students, classes, attClass]);

  const loadAttendance = useCallback(async () => {
    const { data } = await supabase.from("attendance").select("*").eq("class_id", attClass).eq("date", attDate);
    const records: Record<string, string> = {};
    if (data) data.forEach(r => { records[r.student_id] = r.status; });
    // Default to present for students not yet recorded
    attStudents.forEach(s => { if (!records[s.id]) records[s.id] = "present"; });
    setAttRecords(records);
  }, [attClass, attDate, attStudents]);

  useEffect(() => {
    if (attClass && attDate) loadAttendance();
  }, [attClass, attDate, loadAttendance]);

  async function saveAttendance() {
    setAttSaving(true);
    try {
      await saveClassAttendance(attClass, attDate, attRecords, user?.id || null);
      toast({ title: "Attendance saved" });
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setAttSaving(false);
  }

  function markAll(status: string) {
    const newRecords = { ...attRecords };
    attStudents.forEach(s => { newRecords[s.id] = status; });
    setAttRecords(newRecords);
  }

  // ═══ EXAM CRUD ═══
  function openAddExam() {
    setEditingExam(null);
    setExamForm({ name: "", exam_type: "end_of_term", form_level: DEFAULT_FORM, term: "Term 1", academic_year: "2026", start_date: "", end_date: "", subject_ids: [] });
    setExamDialogOpen(true);
  }
  function openEditExam(e: ExamsRow) {
    setEditingExam(e);
    setExamForm({ name: e.name, exam_type: e.exam_type, form_level: e.form_level, term: e.term, academic_year: e.academic_year, start_date: e.start_date || "", end_date: e.end_date || "", subject_ids: e.subject_ids || [] });
    setExamDialogOpen(true);
  }
  async function saveExam() {
    if (!examForm.name) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (examForm.subject_ids.length === 0) { toast({ title: "Select at least one subject", variant: "destructive" }); return; }
    const payload = { ...examForm, start_date: examForm.start_date || null, end_date: examForm.end_date || null };
    if (editingExam) {
      const { error } = await supabase.from("exams").update(payload).eq("id", editingExam.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Exam updated" });
    } else {
      const { error } = await supabase.from("exams").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Exam created" });
    }
    setExamDialogOpen(false);
    fetchExams();
  }
  async function deleteExam(id: string) {
    if (!confirm("Delete this exam and all results?")) return;
    await supabase.from("exams").delete().eq("id", id);
    toast({ title: "Exam deleted" });
    fetchExams();
    fetchExamResults();
  }
  async function togglePublish(exam: ExamsRow) {
    if (!exam.is_published && !confirm("Publish results? Students will be able to view them.")) return;
    await supabase.from("exams").update({ is_published: !exam.is_published }).eq("id", exam.id);
    toast({ title: exam.is_published ? "Results unpublished" : "Results published" });
    fetchExams();
  }

  // ═══ MARKS ENTRY ═══
  const selectedExam = exams.find(e => e.id === marksExam);
  const marksStudents = selectedExam ? students.filter(s => s.form === selectedExam.form_level) : [];
  const currentExamResults = useMemo(
    () => examResults.filter(r => r.exam_id === marksExam && r.subject_id === marksSubject),
    [examResults, marksExam, marksSubject],
  );

  useEffect(() => {
    if (marksExam && marksSubject) {
      const entries: Record<string, string> = {};
      currentExamResults.forEach(r => { entries[r.student_id] = String(r.mark); });
      setMarksEntries(entries);
    }
  }, [marksExam, marksSubject, currentExamResults]);

  async function saveMarks() {
    if (!marksExam || !marksSubject) return;
    setMarksSaving(true);
    try {
      for (const [studentId, markStr] of Object.entries(marksEntries)) {
        const mark = parseFloat(markStr) || 0;
        if (mark < 0 || mark > 100) continue;
        const grade = gradeFor(mark);
        const existing = currentExamResults.find(r => r.student_id === studentId);
        if (existing) {
          await supabase.from("exam_results").update({ mark, grade }).eq("id", existing.id);
        } else {
          await supabase.from("exam_results").insert({ exam_id: marksExam, student_id: studentId, subject_id: marksSubject, mark, grade });
        }
      }
      toast({ title: "Marks saved" });
      fetchExamResults();
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setMarksSaving(false);
  }

  // ═══ RESULTS PROCESSING ═══
  function getStudentResults(examId: string) {
    const results = examResults.filter(r => r.exam_id === examId);
    const byStudent: Record<string, { total: number; count: number; name: string; adm: string }> = {};
    results.forEach(r => {
      if (!byStudent[r.student_id]) byStudent[r.student_id] = { total: 0, count: 0, name: r.students?.full_name || "", adm: r.students?.admission_number || "" };
      byStudent[r.student_id].total += parseFloat(String(r.mark));
      byStudent[r.student_id].count++;
    });
    return Object.entries(byStudent)
      .map(([id, d]) => ({ id, ...d, avg: d.count > 0 ? d.total / d.count : 0 }))
      .sort((a, b) => b.avg - a.avg)
      .map((s, i) => ({ ...s, position: i + 1 }));
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Classes", value: classes.length, icon: Users },
          { label: "Subjects", value: subjects.length, icon: BookOpen },
          { label: "Exams", value: exams.length, icon: GraduationCap },
          { label: "Active Students", value: students.length, icon: Users },
        ].map((c, i) => (
          <Card key={i} className="border-none shadow-maroon">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-light"><c.icon className="h-5 w-5 text-accent" /></div>
              <div><p className="text-2xl font-bold">{c.value}</p><p className="text-xs text-muted-foreground">{c.label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="classes" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="classes"><Users className="mr-1 h-4 w-4" /> Classes</TabsTrigger>
          <TabsTrigger value="subjects"><BookOpen className="mr-1 h-4 w-4" /> Subjects</TabsTrigger>
          <TabsTrigger value="teacher-assign"><UserCheck className="mr-1 h-4 w-4" /> Teacher Assignments</TabsTrigger>
          <TabsTrigger value="timetable"><Clock className="mr-1 h-4 w-4" /> Timetable</TabsTrigger>
          <TabsTrigger value="sports-schedule"><Trophy className="mr-1 h-4 w-4" /> Sports & Clubs</TabsTrigger>
          <TabsTrigger value="attendance"><Calendar className="mr-1 h-4 w-4" /> Attendance</TabsTrigger>
          <TabsTrigger value="exams"><GraduationCap className="mr-1 h-4 w-4" /> Exams</TabsTrigger>
          <TabsTrigger value="exam-timetable"><CalendarDays className="mr-1 h-4 w-4" /> Exam Timetable</TabsTrigger>
          <TabsTrigger value="marks"><FileText className="mr-1 h-4 w-4" /> Marks Entry</TabsTrigger>
          <TabsTrigger value="results"><BarChart3 className="mr-1 h-4 w-4" /> Results</TabsTrigger>
          <TabsTrigger value="term-reports"><ClipboardList className="mr-1 h-4 w-4" /> Term Reports</TabsTrigger>
        </TabsList>

        {/* ═══ CLASSES ═══ */}
        <TabsContent value="classes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div><CardTitle className="font-heading">Classes</CardTitle><CardDescription>Manage class groups</CardDescription></div>
              <div className="flex gap-2">
                <Button onClick={() => { setAssignDialogOpen(true); setAssignClass(""); setAssignSubject(""); setAssignTeacher(""); }} variant="outline"><Plus className="mr-1 h-4 w-4" /> Assign Subject</Button>
                <Button onClick={openAddClass} className="bg-accent hover:bg-accent/90 text-accent-foreground"><Plus className="mr-1 h-4 w-4" /> Add Class</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {classes.length === 0 ? <p className="text-center py-8 text-muted-foreground">No classes yet.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead><TableHead>Form</TableHead><TableHead>Stream</TableHead><TableHead>Teacher</TableHead><TableHead>Room</TableHead><TableHead>Capacity</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {classes.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{c.level}</TableCell>
                          <TableCell>{c.stream || "-"}</TableCell>
                          <TableCell>{c.staff?.full_name || "-"}</TableCell>
                          <TableCell>{c.room || "-"}</TableCell>
                          <TableCell>{c.capacity}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditClass(c)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteClass(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {classSubjects.length > 0 && (
                <div>
                  <h3 className="font-heading text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Subject Assignments</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Class</TableHead><TableHead>Subject</TableHead><TableHead>Teacher</TableHead><TableHead>Actions</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {classSubjects.map(cs => (
                          <TableRow key={cs.id}>
                            <TableCell>{cs.classes?.name}</TableCell>
                            <TableCell>{cs.subjects?.name}</TableCell>
                            <TableCell>{cs.staff?.full_name || "-"}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" onClick={() => removeAssignment(cs.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ SUBJECTS ═══ */}
        <TabsContent value="subjects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="font-heading">Subjects</CardTitle><CardDescription>Manage school subjects</CardDescription></div>
              <Button onClick={openAddSubject} className="bg-accent hover:bg-accent/90 text-accent-foreground"><Plus className="mr-1 h-4 w-4" /> Add Subject</Button>
            </CardHeader>
            <CardContent>
              {subjects.length === 0 ? <p className="text-center py-8 text-muted-foreground">No subjects yet.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Department</TableHead><TableHead>Examinable</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {subjects.map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>{s.code || "-"}</TableCell>
                          <TableCell>{s.department || "-"}</TableCell>
                          <TableCell>{s.is_examinable ? <Badge className="bg-green-100 text-green-800 border-green-300" variant="outline">Yes</Badge> : <Badge variant="outline">No</Badge>}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditSubject(s)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteSubject(s.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ TEACHER ASSIGNMENTS ═══ */}
        <TabsContent value="teacher-assign">
          <TeacherClassAssignment
            classes={classes}
            subjects={subjects}
            staff={staff}
            onRefresh={() => { fetchClassSubjects(); fetchTimetable(); }}
          />
        </TabsContent>

        {/* ═══ TIMETABLE ═══ */}
        <TabsContent value="timetable">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div><CardTitle className="font-heading">Timetable</CardTitle><CardDescription>Visual weekly timetable with clash detection</CardDescription></div>
              <Select value={ttViewClass} onValueChange={setTtViewClass}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {!ttViewClass ? <p className="text-center py-8 text-muted-foreground">Select a class to view/edit timetable.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-2 py-2 border text-left min-w-[80px]">Time</th>
                        {dayNames.map((d, i) => <th key={i} className="px-2 py-2 border text-center min-w-[120px]">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map((slot, si) => (
                        <tr key={si} className={slot.isBreak ? "bg-muted/50" : ""}>
                          <td className="px-2 py-1 border text-xs font-medium whitespace-nowrap">
                            {slot.start}–{slot.end}
                            {slot.isBreak && <span className="block text-muted-foreground">{slot.label}</span>}
                          </td>
                          {slot.isBreak ? (
                            <td colSpan={5} className="border text-center text-xs text-muted-foreground italic">{slot.label}</td>
                          ) : (
                            dayNames.map((_, di) => {
                              const entry = getTTEntry(di, slot.start, slot.end);
                              return (
                                <td key={di} className="px-1 py-1 border cursor-pointer hover:bg-accent/10 transition-colors"
                                  onClick={() => { setTtEditCell({ day: di, slot }); setTtSubject(entry?.subject_id || ""); setTtTeacher(entry?.teacher_id || ""); setTtRoom(entry?.room || ""); }}>
                                  {entry ? (
                                    <div className="text-xs">
                                      <p className="font-semibold text-accent">{entry.subjects?.name || "-"}</p>
                                      <p className="text-muted-foreground">{entry.staff?.full_name?.split(" ").pop() || ""}</p>
                                      {entry.room && <p className="text-muted-foreground">Rm {entry.room}</p>}
                                    </div>
                                  ) : <span className="text-xs text-muted-foreground">-</span>}
                                </td>
                              );
                            })
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ SPORTS & CLUBS SCHEDULE ═══ */}
        <TabsContent value="sports-schedule">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
              <div><CardTitle className="font-heading">Sports & Clubs Schedule</CardTitle><CardDescription>Manage after-school sports and clubs timetable (15:30–17:00)</CardDescription></div>
              <Select value={sportsViewClass} onValueChange={setSportsViewClass}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {!sportsViewClass ? <p className="text-center py-8 text-muted-foreground">Select a class to view/edit sports & clubs schedule.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted">
                        <th className="px-2 py-2 border text-left min-w-[80px]">Time</th>
                        {dayNames.map((d, i) => <th key={i} className="px-2 py-2 border text-center min-w-[120px]">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {sportsSlots.map((slot, si) => (
                        <tr key={si}>
                          <td className="px-2 py-1 border text-xs font-medium whitespace-nowrap">{slot.start}–{slot.end}</td>
                          {dayNames.map((_, di) => {
                            const entry = getSportsEntry(di, slot.start, slot.end);
                            return (
                              <td key={di} className="px-1 py-1 border cursor-pointer hover:bg-accent/10 transition-colors"
                                onClick={() => { setSportsEditCell({ day: di, slot }); setSportsActivity(entry?.activity_name || ""); setSportsVenue(entry?.venue || ""); setSportsCoach(entry?.coach_id || ""); setSportsType(entry?.activity_type || "sport"); }}>
                                {entry ? (
                                  <div className="text-xs">
                                    <p className="font-semibold text-accent">{entry.activity_name}</p>
                                    <p className="text-muted-foreground">{entry.staff?.full_name?.split(" ").pop() || ""}</p>
                                    {entry.venue && <p className="text-muted-foreground">{entry.venue}</p>}
                                  </div>
                                ) : <span className="text-xs text-muted-foreground">-</span>}
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
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Take Attendance</CardTitle>
              <CardDescription>Select class and date, then mark attendance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Select value={attClass} onValueChange={setAttClass}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" className="w-48" value={attDate} onChange={e => setAttDate(e.target.value)} />
                {attClass && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => markAll("present")} className="text-green-700"><CheckCircle className="mr-1 h-4 w-4" /> All Present</Button>
                    <Button variant="outline" size="sm" onClick={() => markAll("absent")} className="text-red-700"><XCircle className="mr-1 h-4 w-4" /> All Absent</Button>
                  </div>
                )}
              </div>

              {attClass && attStudents.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Adm #</TableHead>
                        <TableHead className="text-center">Present</TableHead>
                        <TableHead className="text-center">Absent</TableHead>
                        <TableHead className="text-center">Late</TableHead>
                        <TableHead className="text-center">Excused</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {attStudents.map((s, i) => (
                          <TableRow key={s.id} className={attRecords[s.id] === "absent" ? "bg-red-50" : attRecords[s.id] === "late" ? "bg-amber-50" : ""}>
                            <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                            <TableCell className="font-medium">{s.full_name}</TableCell>
                            <TableCell className="text-xs">{s.admission_number}</TableCell>
                            {["present", "absent", "late", "excused"].map(status => (
                              <TableCell key={status} className="text-center">
                                <input type="radio" name={`att-${s.id}`} checked={attRecords[s.id] === status}
                                  onChange={() => setAttRecords(p => ({ ...p, [s.id]: status }))}
                                  className="h-4 w-4 accent-accent" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={saveAttendance} disabled={attSaving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {attSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save Attendance
                  </Button>

                  {/* Quick stats */}
                  <div className="flex gap-4 text-sm">
                    <span className="text-green-700">✓ Present: {Object.values(attRecords).filter(v => v === "present").length}</span>
                    <span className="text-red-700">✗ Absent: {Object.values(attRecords).filter(v => v === "absent").length}</span>
                    <span className="text-amber-700">⏱ Late: {Object.values(attRecords).filter(v => v === "late").length}</span>
                    <span className="text-purple-700">📋 Excused: {Object.values(attRecords).filter(v => v === "excused").length}</span>
                  </div>
                </>
              ) : attClass ? (
                <p className="text-center py-8 text-muted-foreground">No students found for this class.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ EXAMS ═══ */}
        <TabsContent value="exams">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div><CardTitle className="font-heading">Examinations</CardTitle><CardDescription>Manage exams and assessments</CardDescription></div>
              <Button onClick={openAddExam} className="bg-accent hover:bg-accent/90 text-accent-foreground"><Plus className="mr-1 h-4 w-4" /> Create Exam</Button>
            </CardHeader>
            <CardContent>
              {exams.length === 0 ? <p className="text-center py-8 text-muted-foreground">No exams created.</p> : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Form</TableHead><TableHead>Subjects</TableHead><TableHead>Term</TableHead><TableHead>Year</TableHead><TableHead>Dates</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {exams.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell><Badge variant="outline">{examTypes.find(t => t.value === e.exam_type)?.label || e.exam_type}</Badge></TableCell>
                          <TableCell>{e.form_level}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="flex flex-wrap gap-1">
                              {(e.subject_ids || []).slice(0, 3).map((sid: string) => {
                                const subj = subjects.find(s => s.id === sid);
                                return subj ? <Badge key={sid} variant="secondary" className="text-[10px]">{subj.name}</Badge> : null;
                              })}
                              {(e.subject_ids || []).length > 3 && <Badge variant="secondary" className="text-[10px]">+{e.subject_ids.length - 3}</Badge>}
                              {!(e.subject_ids || []).length && <span className="text-muted-foreground text-xs">-</span>}
                            </div>
                          </TableCell>
                          <TableCell>{e.term}</TableCell>
                          <TableCell>{e.academic_year}</TableCell>
                          <TableCell className="text-xs">{e.start_date || "-"} → {e.end_date || "-"}</TableCell>
                          <TableCell>
                            {e.is_published
                              ? <Badge className="bg-green-100 text-green-800 border-green-300" variant="outline">Published</Badge>
                              : <Badge variant="outline">Draft</Badge>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => togglePublish(e)} title={e.is_published ? "Unpublish" : "Publish"}>
                                {e.is_published ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4 text-green-600" />}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEditExam(e)}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteExam(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ MARKS ENTRY ═══ */}
        <TabsContent value="marks">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Marks Entry</CardTitle>
              <CardDescription>Enter marks per exam and subject (ZIMSEC grading auto-applied)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <Select value={marksExam} onValueChange={v => { setMarksExam(v); setMarksSubject(""); }}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select exam" /></SelectTrigger>
                  <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.form_level})</SelectItem>)}</SelectContent>
                </Select>
                <Select value={marksSubject} onValueChange={setMarksSubject}>
                  <SelectTrigger className="w-48"><SelectValue placeholder="Select subject" /></SelectTrigger>
                  <SelectContent>{subjects.filter(s => s.is_examinable && (!selectedExam?.subject_ids?.length || selectedExam.subject_ids.includes(s.id))).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {marksExam && marksSubject && marksStudents.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>#</TableHead><TableHead>Name</TableHead><TableHead>Adm #</TableHead><TableHead className="w-24">Mark (%)</TableHead><TableHead>Grade</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {marksStudents.map((s, i) => {
                          const mark = parseFloat(marksEntries[s.id] || "0") || 0;
                          const grade = gradeFor(mark);
                          return (
                            <TableRow key={s.id}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-medium">{s.full_name}</TableCell>
                              <TableCell className="text-xs">{s.admission_number}</TableCell>
                              <TableCell>
                                <Input type="number" min="0" max="100" className="h-8 w-20" value={marksEntries[s.id] || ""}
                                  onChange={e => setMarksEntries(p => ({ ...p, [s.id]: e.target.value }))} />
                              </TableCell>
                              <TableCell><Badge variant="outline" className={gradeBadgeClass(grade)}>{grade}</Badge></TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <Button onClick={saveMarks} disabled={marksSaving} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    {marksSaving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Save Marks
                  </Button>
                </>
              ) : marksExam && marksSubject ? (
                <p className="text-center py-8 text-muted-foreground">No students found for this form level.</p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ RESULTS ═══ */}
        <TabsContent value="results">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Results & Rankings</CardTitle>
              <CardDescription>View processed results with class positions. Use search to find specific students.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={marksExam} onValueChange={setMarksExam}>
                  <SelectTrigger className="w-56"><SelectValue placeholder="Select exam" /></SelectTrigger>
                  <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name} ({e.form_level})</SelectItem>)}</SelectContent>
                </Select>
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" placeholder="Search student by name or admission #..." value={resultsSearch} onChange={e => setResultsSearch(e.target.value)} />
                </div>
              </div>

              {marksExam ? (
                (() => {
                  let rankings = getStudentResults(marksExam);
                  if (resultsSearch) {
                    const q = resultsSearch.toLowerCase();
                    rankings = rankings.filter(r => r.name.toLowerCase().includes(q) || r.adm.toLowerCase().includes(q));
                  }
                  if (rankings.length === 0) return <p className="text-center py-8 text-muted-foreground">{resultsSearch ? "No students match your search." : "No results available for this exam."}</p>;
                  return (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Pos</TableHead><TableHead>Name</TableHead><TableHead>Adm #</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Average</TableHead><TableHead>Grade</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {rankings.map(r => {
                            const grade = gradeFor(r.avg);
                            return (
                              <TableRow key={r.id}>
                                <TableCell className="font-bold">{r.position}</TableCell>
                                <TableCell className="font-medium">{r.name}</TableCell>
                                <TableCell className="text-xs">{r.adm}</TableCell>
                                <TableCell className="text-right font-mono">{r.total.toFixed(1)}</TableCell>
                                <TableCell className="text-right font-mono">{r.avg.toFixed(1)}%</TableCell>
                                <TableCell><Badge variant="outline" className={gradeBadgeClass(grade)}>{grade}</Badge></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ EXAM TIMETABLE ═══ */}
        <TabsContent value="exam-timetable">
          <ExamTimetableTab />
        </TabsContent>

        {/* ═══ TERM REPORTS ═══ */}
        <TabsContent value="term-reports">
          <TermReportsTab />
        </TabsContent>
      </Tabs>

      {/* ═══════ DIALOGS ═══════ */}

      {/* Class Dialog */}
      <Dialog open={classDialogOpen} onOpenChange={setClassDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingClass ? "Edit Class" : "Add Class"}</DialogTitle><DialogDescription>Class details</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Name</Label><Input value={classForm.name} onChange={e => setClassForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Form 1A" /></div>
              <div className="space-y-2"><Label>Form Level</Label>
                <Select value={classForm.level} onValueChange={v => setClassForm(p => ({ ...p, level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORM_LEVELS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Stream</Label>
                <Select value={classForm.stream} onValueChange={v => setClassForm(p => ({ ...p, stream: v }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>{streamOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Room</Label><Input value={classForm.room} onChange={e => setClassForm(p => ({ ...p, room: e.target.value }))} placeholder="e.g. B12" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Class Teacher</Label>
                <Select value={classForm.class_teacher_id} onValueChange={v => setClassForm(p => ({ ...p, class_teacher_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Capacity</Label><Input type="number" value={classForm.capacity} onChange={e => setClassForm(p => ({ ...p, capacity: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveClass} className="bg-accent hover:bg-accent/90 text-accent-foreground">{editingClass ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subject Dialog */}
      <Dialog open={subjectDialogOpen} onOpenChange={setSubjectDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingSubject ? "Edit Subject" : "Add Subject"}</DialogTitle><DialogDescription>Subject details</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Name</Label><Input value={subjectForm.name} onChange={e => setSubjectForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Mathematics" /></div>
              <div className="space-y-2"><Label>Code</Label><Input value={subjectForm.code} onChange={e => setSubjectForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. MATH" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Department</Label>
                <Select value={subjectForm.department} onValueChange={v => setSubjectForm(p => ({ ...p, department: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{deptOptions.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2 pb-1">
                <Checkbox checked={subjectForm.is_examinable} onCheckedChange={v => setSubjectForm(p => ({ ...p, is_examinable: !!v }))} id="exam-flag" />
                <Label htmlFor="exam-flag">Examinable</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveSubject} className="bg-accent hover:bg-accent/90 text-accent-foreground">{editingSubject ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Subject Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Subject to Class</DialogTitle><DialogDescription>Link a subject with a teacher to a class</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Class</Label>
              <Select value={assignClass} onValueChange={setAssignClass}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Subject</Label>
              <Select value={assignSubject} onValueChange={setAssignSubject}>
                <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Teacher (optional)</Label>
              <Select value={assignTeacher} onValueChange={setAssignTeacher}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
            <Button onClick={assignSubjectToClass} className="bg-accent hover:bg-accent/90 text-accent-foreground">Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Timetable Cell Edit Dialog */}
      <Dialog open={!!ttEditCell} onOpenChange={() => setTtEditCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Timetable Slot</DialogTitle>
            <DialogDescription>{ttEditCell && `${dayNames[ttEditCell.day]} ${ttEditCell.slot.start}–${ttEditCell.slot.end}`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Subject</Label>
              <Select value={ttSubject} onValueChange={setTtSubject}>
                <SelectTrigger><SelectValue placeholder="Select (leave empty to clear)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__clear">Clear selection</SelectItem>
                  {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Teacher</Label>
              <Select value={ttTeacher} onValueChange={setTtTeacher}>
                <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Room</Label>
              <Input value={ttRoom} onChange={e => setTtRoom(e.target.value)} placeholder="e.g. Lab 1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTtEditCell(null)}>Cancel</Button>
            <Button onClick={() => { if (ttSubject === "__clear") setTtSubject(""); saveTTEntry(); }} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sports Schedule Edit Dialog */}
      <Dialog open={!!sportsEditCell} onOpenChange={() => setSportsEditCell(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Sports/Club Slot</DialogTitle>
            <DialogDescription>{sportsEditCell && `${dayNames[sportsEditCell.day]} ${sportsEditCell.slot.start}–${sportsEditCell.slot.end}`}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Activity</Label>
              <Select value={sportsActivity} onValueChange={setSportsActivity}>
                <SelectTrigger><SelectValue placeholder="Select activity (leave empty to clear)" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="__clear">Clear selection</SelectItem>
                  {sportsActivityOptions.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Type</Label>
              <Select value={sportsType} onValueChange={setSportsType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sport">Sport</SelectItem>
                  <SelectItem value="club">Club</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Coach / Supervisor</Label>
              <Select value={sportsCoach} onValueChange={setSportsCoach}>
                <SelectTrigger><SelectValue placeholder="Select coach" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Venue</Label>
              <Input value={sportsVenue} onChange={e => setSportsVenue(e.target.value)} placeholder="e.g. Main Field" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSportsEditCell(null)}>Cancel</Button>
            <Button onClick={() => { if (sportsActivity === "__clear") setSportsActivity(""); saveSportsEntry(); }} className="bg-accent hover:bg-accent/90 text-accent-foreground">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exam Dialog */}
      <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingExam ? "Edit Exam" : "Create Exam"}</DialogTitle><DialogDescription>Define exam details and select subjects</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2"><Label>Name</Label><Input value={examForm.name} onChange={e => setExamForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. End of Term 1 2026" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Type</Label>
                <Select value={examForm.exam_type} onValueChange={v => setExamForm(p => ({ ...p, exam_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{examTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Form Level</Label>
                <Select value={examForm.form_level} onValueChange={v => setExamForm(p => ({ ...p, form_level: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORM_LEVELS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Term</Label>
                <Select value={examForm.term} onValueChange={v => setExamForm(p => ({ ...p, term: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{termOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Academic Year</Label><Input value={examForm.academic_year} onChange={e => setExamForm(p => ({ ...p, academic_year: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={examForm.start_date} onChange={e => setExamForm(p => ({ ...p, start_date: e.target.value }))} /></div>
              <div className="space-y-2"><Label>End Date</Label><Input type="date" value={examForm.end_date} onChange={e => setExamForm(p => ({ ...p, end_date: e.target.value }))} /></div>
            </div>
            {/* Subjects Selection */}
            <div className="space-y-2">
              <Label>Exam Subjects ({examForm.subject_ids.length} selected)</Label>
              <div className="flex gap-2 mb-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setExamForm(p => ({ ...p, subject_ids: subjects.filter(s => s.is_examinable).map(s => s.id) }))}>Select All</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setExamForm(p => ({ ...p, subject_ids: [] }))}>Clear All</Button>
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto rounded-md border p-3">
                {subjects.filter(s => s.is_examinable).map(s => (
                  <div key={s.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`exam-subj-${s.id}`}
                      checked={examForm.subject_ids.includes(s.id)}
                      onCheckedChange={(checked) => {
                        setExamForm(p => ({
                          ...p,
                          subject_ids: checked
                            ? [...p.subject_ids, s.id]
                            : p.subject_ids.filter(id => id !== s.id)
                        }));
                      }}
                    />
                    <Label htmlFor={`exam-subj-${s.id}`} className="text-sm cursor-pointer">
                      {s.name} {s.code ? <span className="text-muted-foreground">({s.code})</span> : null}
                    </Label>
                  </div>
                ))}
              </div>
              {subjects.filter(s => s.is_examinable).length === 0 && (
                <p className="text-xs text-muted-foreground">No examinable subjects found. Add subjects in the Subjects tab first.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExamDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveExam} className="bg-accent hover:bg-accent/90 text-accent-foreground">{editingExam ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
