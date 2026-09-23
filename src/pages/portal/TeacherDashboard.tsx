import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  LogOut, BookOpen, Bell, BarChart3, Calendar, CalendarDays, ClipboardList,
  FileText, Users, CheckCircle2, Clock, GraduationCap, AlertCircle, CalendarOff,
  TrendingUp, FolderOpen, MessageSquare, Sparkles
} from "lucide-react";
import ReportCardCommentGenerator from "@/components/teacher/ReportCardCommentGenerator";
import ParentMessageComposer from "@/components/teacher/ParentMessageComposer";
import schoolLogo from "@/assets/mavingtech-logo.png";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { saveClassAttendance } from "@/lib/attendance";
import PersonalTimetableEditor from "@/components/PersonalTimetableEditor";
import NotificationBell from "@/components/NotificationBell";
import AssessmentsTab from "@/components/teacher/AssessmentsTab";
import EnhancedMaterialsTab from "@/components/teacher/EnhancedMaterialsTab";
import EnhancedAnnouncementsTab from "@/components/teacher/EnhancedAnnouncementsTab";
import BulkMarksUpload from "@/components/teacher/BulkMarksUpload";
import TeacherMarksReport from "@/components/teacher/TeacherMarksReport";
import StaffLeaveRequest from "@/components/teacher/StaffLeaveRequest";
import ExamResultsUpload from "@/components/teacher/ExamResultsUpload";
import StudentExamTimetableTab from "@/components/student/StudentExamTimetableTab";
import LessonPlansTab from "@/components/teacher/LessonPlansTab";
import TeacherAIAssistant from "@/components/teacher/TeacherAIAssistant";
import AIAssistantHub from "@/components/teacher/ai/AIAssistantHub";
import StudentProgressTracker from "@/components/teacher/StudentProgressTracker";
import ResourceLibraryTab from "@/components/teacher/ResourceLibraryTab";
import ParentCommunicationLog from "@/components/teacher/ParentCommunicationLog";
import FullWeekTimetable from "@/components/shared/FullWeekTimetable";
import PublishedTimetableWidget from "@/components/timetable/PublishedTimetableWidget";
const termOptions = ["Term 1", "Term 2", "Term 3"];
const assessmentTypes = ["test", "exam", "assignment", "project"];

function zimGrade(mark: number): string {
  if (mark >= 90) return "A*";
  if (mark >= 80) return "A";
  if (mark >= 70) return "B";
  if (mark >= 60) return "C";
  if (mark >= 50) return "D";
  if (mark >= 40) return "E";
  return "U";
}

interface TeacherDashboardProps {
  embedded?: boolean;
}

export default function TeacherDashboard({ embedded = false }: TeacherDashboardProps) {
  const { toast } = useToast();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<any>(null);
  const [staffInfo, setStaffInfo] = useState<any>(null);
  const [classes, setClasses] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [myMaterials, setMyMaterials] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [myAnnouncements, setMyAnnouncements] = useState<any[]>([]);
  const [attendanceClasses, setAttendanceClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ classCount: 0, pendingGrading: 0, materialsCount: 0, upcomingHw: 0 });

  // Mark form
  const [markForm, setMarkForm] = useState({ student_id: "", subject_id: "", mark: "", term: "Term 1", assessment_type: "test", description: "", comment: "" });
  const [markLoading, setMarkLoading] = useState(false);

  // Homework form
  const [hwForm, setHwForm] = useState({ class_id: "", subject_id: "", title: "", due_date: "", description: "" });
  const [hwLoading, setHwLoading] = useState(false);

  // Attendance
  const [attClass, setAttClass] = useState("");
  const [attDate, setAttDate] = useState(new Date().toISOString().split("T")[0]);
  const [attStudents, setAttStudents] = useState<any[]>([]);
  const [attRecords, setAttRecords] = useState<Record<string, string>>({});
  const [attLoading, setAttLoading] = useState(false);

  // Timetable
  const [selectedTTClass, setSelectedTTClass] = useState("");
  const [timetableData, setTimetableData] = useState<any[]>([]);

  useEffect(() => { if (user) fetchAll(); }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    const [profRes, subRes, allClassRes, staffRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user!.id).single(),
      supabase.from("subjects").select("*").order("name"),
      supabase.from("classes").select("*").order("name"),
      supabase.from("staff").select("id, staff_number, department, role").eq("user_id", user!.id).single(),
    ]);
    if (profRes.data) setProfile(profRes.data);
    if (staffRes.data) setStaffInfo(staffRes.data);
    if (subRes.data) setSubjects(subRes.data);

    // Filter classes to only those assigned to this teacher
    const allClasses = allClassRes.data || [];
    let teacherClasses = allClasses;
    
    if (staffRes.data) {
      const staffId = staffRes.data.id;
      // Get classes assigned via class_subjects
      const { data: csData } = await supabase
        .from("class_subjects")
        .select("class_id")
        .eq("teacher_id", staffId);
      
      const assignedClassIds = new Set<string>();
      // Classes where teacher is class_teacher
      allClasses.forEach(c => {
        if (c.class_teacher_id === staffId) assignedClassIds.add(c.id);
      });
      // Classes where teacher teaches a subject
      if (csData) {
        csData.forEach(cs => assignedClassIds.add(cs.class_id));
      }
      
      if (assignedClassIds.size > 0) {
        teacherClasses = allClasses.filter(c => assignedClassIds.has(c.id));
      }
    }

    setClasses(teacherClasses);
    setAttendanceClasses(teacherClasses);
    if (teacherClasses.length > 0) setSelectedTTClass(teacherClasses[0].id);

    const { data: allStudents } = await supabase.from("students").select("id, full_name, form, stream, admission_number").eq("status", "active").order("full_name");
    if (allStudents) setStudents(allStudents);

    const { data: mats } = await supabase.from("study_materials").select("*, classes(name), subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    if (mats) setMyMaterials(mats);

    const { data: marksData } = await supabase.from("marks").select("*, subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false }).limit(50);
    if (marksData) setMarks(marksData);

    const { data: hwData } = await supabase.from("homework").select("*, subjects(name), classes:class_id(name)").eq("teacher_id", user!.id).order("due_date", { ascending: false }).limit(50);
    if (hwData) setHomework(hwData);

    const { data: ann } = await supabase.from("announcements").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(20);
    if (ann) setAnnouncements(ann);

    const { data: myAnn } = await supabase.from("announcements").select("*").eq("author_id", user!.id).order("created_at", { ascending: false }).limit(20);
    if (myAnn) setMyAnnouncements(myAnn);

    const classCount = teacherClasses.length;
    const upcomingHw = hwData?.filter(h => new Date(h.due_date) >= new Date()).length || 0;
    setStats({ classCount, pendingGrading: 0, materialsCount: mats?.length || 0, upcomingHw });

    setLoading(false);
  };

  useEffect(() => {
    if (!selectedTTClass) return;
    const loadTT = () => {
      supabase.from("timetable_entries").select("*, subjects(name), staff(full_name)").eq("class_id", selectedTTClass).order("start_time").then(({ data }) => {
        if (data) setTimetableData(data || []);
      });
    };
    loadTT();
    const channel = supabase
      .channel(`teacher-tt-${selectedTTClass}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "timetable_entries", filter: `class_id=eq.${selectedTTClass}` }, () => loadTT())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTTClass]);

  useEffect(() => {
    if (!attClass) return;
    (async () => {
      // Load students for this class
      const { data: sc } = await supabase.from("student_classes").select("student_id").eq("class_id", attClass);
      let studs: any[] = [];
      if (sc && sc.length > 0) {
        const ids = sc.map(s => s.student_id);
        const { data } = await supabase.from("students").select("id, full_name, admission_number").in("id", ids).eq("status", "active").order("full_name");
        if (data) studs = data;
      } else {
        const cls = classes.find(c => c.id === attClass);
        const grade = cls?.level;
        if (grade) {
          let q = supabase.from("students").select("id, full_name, admission_number").eq("status", "active").or(`form.eq.${grade},class.eq.${cls?.name}`);
          const { data } = await q.order("full_name");
          if (data) studs = cls?.stream ? data.filter((_: any, i: number, a: any[]) => true) : data;
        }
      }
      setAttStudents(studs);
      // Default all to present, then overlay any existing records
      const defaults: Record<string, string> = {};
      studs.forEach(s => { defaults[s.id] = "present"; });
      if (studs.length > 0 && attDate) {
        const { data: existing } = await supabase.from("attendance").select("student_id, status").eq("class_id", attClass).eq("date", attDate);
        if (existing) {
          existing.forEach(r => { defaults[r.student_id] = r.status; });
        }
      }
      setAttRecords(defaults);
    })();
  }, [attClass, attDate]);

  const submitMark = async () => {
    const { student_id, subject_id, mark, term, assessment_type, description, comment } = markForm;
    if (!student_id || !subject_id || !mark) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    setMarkLoading(true);
    const { error } = await supabase.from("marks").insert({ student_id, subject_id, mark: parseInt(mark), term, assessment_type, comment: [description, comment].filter(Boolean).join(" — ") || null, teacher_id: user!.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: `Mark submitted — Grade: ${zimGrade(parseInt(mark))}` });
      await supabase.from("notifications").insert({ user_id: user!.id, title: "Mark Recorded", message: `Grade ${zimGrade(parseInt(mark))} recorded for ${assessment_type}.`, type: "mark" });
      setMarkForm({ student_id: "", subject_id: "", mark: "", term: "Term 1", assessment_type: "test", description: "", comment: "" });
      const { data } = await supabase.from("marks").select("*, subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false }).limit(50);
      if (data) setMarks(data);
    }
    setMarkLoading(false);
  };

  const submitHomework = async () => {
    const { class_id, subject_id, title, due_date, description } = hwForm;
    if (!class_id || !subject_id || !title || !due_date) { toast({ title: "Fill all required fields", variant: "destructive" }); return; }
    setHwLoading(true);
    const { error } = await supabase.from("homework").insert({ class_id, subject_id, title, due_date, description: description || null, teacher_id: user!.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    else {
      toast({ title: "Homework posted!" });
      setHwForm({ class_id: "", subject_id: "", title: "", due_date: "", description: "" });
      const { data } = await supabase.from("homework").select("*, subjects(name), classes:class_id(name)").eq("teacher_id", user!.id).order("due_date", { ascending: false }).limit(50);
      if (data) setHomework(data);
    }
    setHwLoading(false);
  };

  const submitAttendance = async () => {
    if (!attClass || !attDate || attStudents.length === 0) { toast({ title: "Select class and date", variant: "destructive" }); return; }
    setAttLoading(true);
    const statuses = Object.fromEntries(attStudents.map(s => [s.id, attRecords[s.id] || "present"]));
    try {
      await saveClassAttendance(attClass, attDate, statuses, user!.id);
      toast({ title: `Attendance saved — ${Object.values(statuses).filter(s => s === "present").length}/${attStudents.length} present` });
    } catch (e) {
      toast({ title: "Error", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
    setAttLoading(false);
  };

  const markAllPresent = () => { const r: Record<string, string> = {}; attStudents.forEach(s => { r[s.id] = "present"; }); setAttRecords(r); };
  const markAllAbsent = () => { const r: Record<string, string> = {}; attStudents.forEach(s => { r[s.id] = "absent"; }); setAttRecords(r); };

  const refreshMaterials = async () => {
    const { data } = await supabase.from("study_materials").select("*, classes(name), subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false });
    if (data) { setMyMaterials(data); setStats(p => ({ ...p, materialsCount: data.length })); }
  };

  const refreshAnnouncements = async () => {
    const [{ data: ann }, { data: myAnn }] = await Promise.all([
      supabase.from("announcements").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(20),
      supabase.from("announcements").select("*").eq("author_id", user!.id).order("created_at", { ascending: false }).limit(20),
    ]);
    if (ann) setAnnouncements(ann);
    if (myAnn) setMyAnnouncements(myAnn);
  };

  const refreshMarks = async () => {
    const { data } = await supabase.from("marks").select("*, subjects(name)").eq("teacher_id", user!.id).order("created_at", { ascending: false }).limit(50);
    if (data) setMarks(data);
    await refreshAiResults();
  };

  const refreshAiResults = async () => {
    // Load AI-marked (graded_by IS NULL) results for assessments owned by this teacher
    const { data: myAssess } = await supabase.from("assessments").select("id").eq("teacher_id", user!.id);
    const ids = (myAssess || []).map(a => a.id);
    if (ids.length === 0) { setAiResults([]); return; }
    const { data } = await supabase
      .from("assessment_results")
      .select("id, mark, feedback, graded_by, created_at, assessment_id, student_id, assessments(title, max_marks, assessment_type, subjects(name)), students(full_name)")
      .in("assessment_id", ids)
      .order("created_at", { ascending: false })
      .limit(100);
    if (data) setAiResults(data);
  };

  // Realtime: refresh AI results when new rows land
  useEffect(() => {
    if (!user) return;
    refreshAiResults();
    const ch = supabase
      .channel(`teacher-ai-results-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "assessment_results" }, () => refreshAiResults())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  const handleLogout = async () => { await signOut(); navigate("/login"); };
  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Teacher";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const ttTimeSlots = [
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
    { start: "15:30", end: "16:10", isSports: true },
    { start: "16:10", end: "17:00", isSports: true },
  ];
  const getTimetableCell = (start: string, di: number) => {
    const entry = timetableData.find(t => t.start_time === start && t.day_of_week === di);
    return entry?.subjects?.name || "—";
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className={embedded ? "" : "min-h-screen bg-background"}>
      {!embedded && (
        <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
          <div className="container flex h-14 sm:h-20 items-center justify-between px-3 sm:px-4">
            <div className="flex items-center gap-2">
              <img src={schoolLogo} alt="MavingTech High School" className="h-[7.5rem] w-[7.5rem] sm:h-[10.5rem] sm:w-[10.5rem] object-contain" />
              <span className="font-heading text-sm sm:text-lg font-bold text-primary">Teacher Portal</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="hidden text-sm text-muted-foreground sm:inline">{displayName}</span>
              <NotificationBell />
              <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex"><LogOut className="mr-1 h-4 w-4" /> Logout</Button>
              <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden h-8 w-8"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>
        </header>
      )}

      <div className={embedded ? "space-y-4 sm:space-y-6" : "container px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6"}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="font-heading text-lg sm:text-2xl font-bold text-primary mb-1">Welcome, {displayName}</h1>
          {staffInfo?.staff_number && (
            <p className="text-sm text-muted-foreground mb-4">Staff No: <span className="font-medium text-foreground">{staffInfo.staff_number}</span>{staffInfo.department ? ` · ${staffInfo.department}` : ""}</p>
          )}
          <a href="/portal/teacher/ai-marker" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 transition hover:from-primary/15">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">✨</div>
              <div>
                <p className="font-heading font-semibold text-foreground">AI Shadow Marker</p>
                <p className="text-xs text-muted-foreground">Auto-grade MCQs & let AI draft essay grades and feedback.</p>
              </div>
            </div>
            <Button size="sm" variant="outline">Open</Button>
          </a>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card><CardContent className="flex items-center gap-3 p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.classCount}</p>
                <p className="text-xs text-muted-foreground">Classes</p>
                {classes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {classes.map(c => (
                      <Badge key={c.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {c.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div><p className="text-2xl font-bold">{stats.materialsCount}</p><p className="text-xs text-muted-foreground">Materials</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <GraduationCap className="h-8 w-8 text-primary" />
              <div><p className="text-2xl font-bold">{marks.length}</p><p className="text-xs text-muted-foreground">Marks Entered</p></div>
            </CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4">
              <Clock className="h-8 w-8 text-primary" />
              <div><p className="text-2xl font-bold">{stats.upcomingHw}</p><p className="text-xs text-muted-foreground">Upcoming Tasks</p></div>
            </CardContent></Card>
          </div>
        </motion.div>

        <PublishedTimetableWidget title="Teaching Timetable" mode="teacher" filterValue={displayName} />


        <Tabs defaultValue="materials" className="space-y-4">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="flex-wrap sm:flex-wrap h-auto gap-1 w-max sm:w-auto">
            <TabsTrigger value="materials" className="text-xs sm:text-sm"><FileText className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Materials</TabsTrigger>
            <TabsTrigger value="assessments" className="text-xs sm:text-sm"><ClipboardList className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Assessments</TabsTrigger>
            <TabsTrigger value="exam-results" className="text-xs sm:text-sm"><GraduationCap className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Results</TabsTrigger>
            <TabsTrigger value="marks" className="text-xs sm:text-sm"><BarChart3 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Marks</TabsTrigger>
            <TabsTrigger value="homework" className="text-xs sm:text-sm"><BookOpen className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Homework</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs sm:text-sm"><CheckCircle2 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Attendance</TabsTrigger>
            <TabsTrigger value="announcements" className="text-xs sm:text-sm"><Bell className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Notices</TabsTrigger>
            <TabsTrigger value="timetable" className="text-xs sm:text-sm"><Calendar className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Timetable</TabsTrigger>
            <TabsTrigger value="exam-timetable" className="text-xs sm:text-sm"><CalendarDays className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Exam TT</TabsTrigger>
            <TabsTrigger value="lesson-plans" className="text-xs sm:text-sm"><BookOpen className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Lessons</TabsTrigger>
            <TabsTrigger value="progress" className="text-xs sm:text-sm"><TrendingUp className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Progress</TabsTrigger>
            <TabsTrigger value="resources" className="text-xs sm:text-sm"><FolderOpen className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Resources</TabsTrigger>
            <TabsTrigger value="parent-log" className="text-xs sm:text-sm"><MessageSquare className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Parents</TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs sm:text-sm"><ClipboardList className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Schedule</TabsTrigger>
            <TabsTrigger value="leave" className="text-xs sm:text-sm"><CalendarOff className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Leave</TabsTrigger>
            <TabsTrigger value="ai-assist" className="text-xs sm:text-sm bg-gradient-to-r from-primary/10 to-accent/10 data-[state=active]:from-primary/30 data-[state=active]:to-accent/30"><Sparkles className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" /> AI Assist</TabsTrigger>
          </TabsList>
          </div>

          {/* MATERIALS - Enhanced */}
          <TabsContent value="materials">
            <EnhancedMaterialsTab userId={user!.id} classes={classes} subjects={subjects} materials={myMaterials} onRefresh={refreshMaterials} />
          </TabsContent>

          {/* ASSESSMENTS - New */}
          <TabsContent value="assessments">
            <AssessmentsTab userId={user!.id} classes={classes} subjects={subjects} students={students} />
          </TabsContent>
          {/* EXAM RESULTS UPLOAD */}
          <TabsContent value="exam-results">
            <ExamResultsUpload userId={user!.id} classes={classes} subjects={subjects} />
          </TabsContent>

          {/* MARKS */}
          <TabsContent value="marks" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-heading">Enter Student Mark</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Student *</Label>
                    <Select value={markForm.student_id} onValueChange={v => setMarkForm(p => ({ ...p, student_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Subject *</Label>
                    <Select value={markForm.subject_id} onValueChange={v => setMarkForm(p => ({ ...p, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Term</Label>
                      <Select value={markForm.term} onValueChange={v => setMarkForm(p => ({ ...p, term: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{termOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Type</Label>
                      <Select value={markForm.assessment_type} onValueChange={v => setMarkForm(p => ({ ...p, assessment_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{assessmentTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Description *</Label><Input value={markForm.description} onChange={e => setMarkForm(p => ({ ...p, description: e.target.value }))} placeholder="e.g. Test 1, Assignment 2, Mid-term Exam" /></div>
                  <div className="space-y-2"><Label>Mark (%) *</Label><Input type="number" min="0" max="100" value={markForm.mark} onChange={e => setMarkForm(p => ({ ...p, mark: e.target.value }))} />
                    {markForm.mark && <p className="text-xs text-muted-foreground">Grade: <span className="font-bold text-primary">{zimGrade(parseInt(markForm.mark))}</span></p>}
                  </div>
                  <div className="space-y-2"><Label>Comment</Label><Textarea rows={2} value={markForm.comment} onChange={e => setMarkForm(p => ({ ...p, comment: e.target.value }))} /></div>
                  <Button onClick={submitMark} disabled={markLoading} className="w-full">{markLoading ? "Submitting..." : "Submit Mark"}</Button>
                </CardContent>
              </Card>
              <div className="space-y-6">
                {(() => {
                  const manualRows = marks.map((m: any) => ({
                    id: `m-${m.id}`, source: "manual", studentName: null,
                    subject: m.subjects?.name || "—", description: m.description || "—",
                    type: m.assessment_type, scoreLabel: `${m.mark}%`, percent: Number(m.mark) || 0,
                    created_at: m.created_at,
                  }));
                  const aiRows = aiResults.map((r: any) => {
                    const max = Number(r.assessments?.max_marks) || 0;
                    const scored = Number(r.mark) || 0;
                    const pct = max > 0 ? Math.round((scored / max) * 100) : scored;
                    return {
                      id: `r-${r.id}`, source: r.graded_by ? "teacher-graded" : "ai",
                      studentName: r.students?.full_name || null,
                      subject: r.assessments?.subjects?.name || "—",
                      description: r.assessments?.title || "Assessment",
                      type: r.assessments?.assessment_type || "assessment",
                      scoreLabel: max > 0 ? `${scored}/${max}` : `${scored}`,
                      percent: pct, created_at: r.created_at,
                    };
                  });
                  const combined = [...manualRows, ...aiRows]
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                    .slice(0, 80);
                  return (
                    <Card>
                      <CardHeader><CardTitle className="font-heading">Recent Marks ({combined.length})</CardTitle></CardHeader>
                      <CardContent className="overflow-x-auto">
                        {combined.length === 0 ? <p className="text-sm text-muted-foreground">No marks submitted yet.</p> : (
                          <table className="w-full text-sm">
                            <thead className="bg-muted"><tr>
                              <th className="px-3 py-2 text-left">Student</th>
                              <th className="px-3 py-2 text-left">Subject</th>
                              <th className="px-3 py-2">Description</th>
                              <th className="px-3 py-2">Type</th>
                              <th className="px-3 py-2">Source</th>
                              <th className="px-3 py-2">Score</th>
                              <th className="px-3 py-2">Grade</th>
                            </tr></thead>
                            <tbody>{combined.map(r => (
                              <tr key={r.id} className="border-b">
                                <td className="px-3 py-2">{r.studentName || "—"}</td>
                                <td className="px-3 py-2">{r.subject}</td>
                                <td className="px-3 py-2 text-center">{r.description}</td>
                                <td className="px-3 py-2 text-center capitalize">{r.type}</td>
                                <td className="px-3 py-2 text-center">
                                  {r.source === "ai"
                                    ? <Badge variant="outline" className="bg-violet-50 text-violet-700 border-violet-300"><Sparkles className="h-3 w-3 mr-1" />AI Marked</Badge>
                                    : <Badge variant="outline">Teacher</Badge>}
                                </td>
                                <td className="px-3 py-2 text-center font-bold">{r.scoreLabel}</td>
                                <td className="px-3 py-2 text-center"><Badge>{zimGrade(r.percent)}</Badge></td>
                              </tr>
                            ))}</tbody>
                          </table>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}
                <BulkMarksUpload userId={user!.id} classes={classes} subjects={subjects} students={students} onMarksUploaded={refreshMarks} />
              </div>
            </div>
            <TeacherMarksReport userId={user!.id} classes={classes} subjects={subjects} />

          </TabsContent>

          {/* HOMEWORK */}
          <TabsContent value="homework" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle className="font-heading">Post Homework</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><Label>Class *</Label>
                      <Select value={hwForm.class_id} onValueChange={v => setHwForm(p => ({ ...p, class_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Subject *</Label>
                      <Select value={hwForm.subject_id} onValueChange={v => setHwForm(p => ({ ...p, subject_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Title *</Label><Input value={hwForm.title} onChange={e => setHwForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Chapter 7 Exercises" /></div>
                  <div className="space-y-2"><Label>Due Date *</Label><Input type="date" value={hwForm.due_date} onChange={e => setHwForm(p => ({ ...p, due_date: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea rows={3} value={hwForm.description} onChange={e => setHwForm(p => ({ ...p, description: e.target.value }))} /></div>
                  <Button onClick={submitHomework} disabled={hwLoading} className="w-full">{hwLoading ? "Posting..." : "Post Homework"}</Button>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="font-heading">Posted Homework ({homework.length})</CardTitle></CardHeader>
                <CardContent>
                  {homework.length === 0 ? <p className="text-sm text-muted-foreground">No homework posted yet.</p> : (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {homework.map(h => (
                        <div key={h.id} className="rounded-lg border p-3">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-sm">{h.title}</p>
                            <Badge variant={new Date(h.due_date) < new Date() ? "destructive" : "default"} className="text-xs">Due: {new Date(h.due_date).toLocaleDateString()}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{h.classes?.name} • {h.subjects?.name}</p>
                          {h.description && <p className="text-xs mt-1">{h.description}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ATTENDANCE */}
          <TabsContent value="attendance" className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="font-heading">Take Attendance</CardTitle><CardDescription>Select a class and date, then mark each student.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><Label>Class *</Label>
                    <Select value={attClass} onValueChange={setAttClass}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>{attendanceClasses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Date</Label><Input type="date" value={attDate} onChange={e => setAttDate(e.target.value)} /></div>
                </div>
                {attStudents.length > 0 && (
                  <>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={markAllPresent}><CheckCircle2 className="mr-1 h-4 w-4" /> All Present</Button>
                      <Button variant="outline" size="sm" onClick={markAllAbsent}><AlertCircle className="mr-1 h-4 w-4" /> All Absent</Button>
                    </div>
                    <div className="max-h-[400px] overflow-y-auto space-y-2">
                      {attStudents.map(s => (
                        <div key={s.id} className="flex items-center justify-between rounded border p-2">
                          <div>
                            <p className="text-sm font-medium">{s.full_name}</p>
                            <p className="text-xs text-muted-foreground">{s.admission_number}</p>
                          </div>
                          <Select value={attRecords[s.id] || "present"} onValueChange={v => setAttRecords(p => ({ ...p, [s.id]: v }))}>
                            <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="excused">Excused</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                    <Button onClick={submitAttendance} disabled={attLoading} className="w-full">{attLoading ? "Saving..." : `Save Attendance (${attStudents.length} students)`}</Button>
                  </>
                )}
                {attClass && attStudents.length === 0 && <p className="text-sm text-muted-foreground">No students found for this class.</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ANNOUNCEMENTS - Enhanced */}
          <TabsContent value="announcements">
            <EnhancedAnnouncementsTab userId={user!.id} classes={classes} announcements={announcements} myAnnouncements={myAnnouncements} onRefresh={refreshAnnouncements} />
          </TabsContent>

          {/* TIMETABLE */}
          <TabsContent value="timetable">
            <div className="space-y-4">
              <Select value={selectedTTClass} onValueChange={setSelectedTTClass}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <FullWeekTimetable
                entries={timetableData}
                hasClass={!!selectedTTClass}
                loading={false}
                noClassMessage="Select a class to view the timetable."
              />
            </div>
          </TabsContent>

          {/* EXAM TIMETABLE */}
          <TabsContent value="exam-timetable">
            <StudentExamTimetableTab showAll />
          </TabsContent>

          {/* LESSON PLANS */}
          <TabsContent value="lesson-plans">
            <LessonPlansTab userId={user!.id} classes={classes} subjects={subjects} />
          </TabsContent>

          {/* STUDENT PROGRESS */}
          <TabsContent value="progress">
            <StudentProgressTracker userId={user!.id} classes={classes} subjects={subjects} />
          </TabsContent>

          {/* RESOURCE LIBRARY */}
          <TabsContent value="resources">
            <ResourceLibraryTab userId={user!.id} subjects={subjects} />
          </TabsContent>

          {/* PARENT COMMUNICATION LOG */}
          <TabsContent value="parent-log">
            <ParentCommunicationLog userId={user!.id} students={students} />
          </TabsContent>

          {/* MY SCHEDULE */}
          <TabsContent value="schedule">
            <PersonalTimetableEditor />
          </TabsContent>

          {/* LEAVE REQUESTS */}
          <TabsContent value="leave">
            <StaffLeaveRequest />
          </TabsContent>

          {/* AI ASSIST */}
          <TabsContent value="ai-assist" className="space-y-4">
            <AIAssistantHub students={students} />
            <TeacherAIAssistant />
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
              <CardHeader>
                <CardTitle className="font-heading flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" /> AI Assistants
                  <Badge variant="secondary" className="ml-2 bg-gradient-to-r from-primary/20 to-accent/20">Powered by AI</Badge>
                </CardTitle>
                <CardDescription>
                  Speed up admin writing tasks. Every output is editable before you save or send.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-heading flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Report Card Comments
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Generate 3–4 sentence narrative comments from a student's marks, attendance and your notes. Pick the tone.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ReportCardCommentGenerator students={students} marks={marks} subjects={subjects} triggerLabel="Open Generator" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-heading flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" /> Parent / Student Messages
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Draft personalised progress updates, concerns, meeting invites or fee reminders. Regenerate for alternative phrasing.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ParentMessageComposer students={students} teacherName={profile?.full_name || staffInfo?.full_name} triggerLabel="Open Composer" />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-heading flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-primary" /> Lesson Plan AI
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Already integrated. Open the <strong>Lessons</strong> tab and use the <em>AI Generate</em> button to draft a full plan.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button variant="outline" className="w-full" onClick={() => {
                        const el = document.querySelector('[data-state][value="lesson-plans"]') as HTMLElement | null;
                        el?.click();
                      }}>
                        Go to Lessons
                      </Button>
                    </CardContent>
                  </Card>
                </div>
                <p className="text-xs text-muted-foreground">
                  ✨ All AI-generated text is clearly labelled and fully editable. AI assists — you decide what gets sent.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
