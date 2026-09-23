import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, BarChart3, BookOpen, Bell, LogOut, Calendar, ClipboardList } from "lucide-react";
import PersonalTimetableEditor from "@/components/PersonalTimetableEditor";
import schoolLogo from "@/assets/mavingtech-logo.png";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
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
  { start: "15:30", end: "16:10" },
  { start: "16:10", end: "17:00" },
];
const termOptions = ["Term 1", "Term 2", "Term 3"];
const assessmentTypes = ["test", "exam", "assignment", "project"];

export default function ParentTeacherDashboard() {
  const { toast } = useToast();
  const { signOut, user, role } = useAuth();
  const navigate = useNavigate();

  // Data from DB
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [marks, setMarks] = useState<any[]>([]);
  const [homework, setHomework] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [timetableData, setTimetableData] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  // Mark form
  const [markForm, setMarkForm] = useState({ student_id: "", subject_id: "", mark: "", term: "Term 1", assessment_type: "test", comment: "" });
  const [markLoading, setMarkLoading] = useState(false);

  // Homework form
  const [hwForm, setHwForm] = useState({ class_id: "", subject_id: "", title: "", due_date: "", description: "" });
  const [hwLoading, setHwLoading] = useState(false);

  // Timetable class selection
  const [selectedTTClass, setSelectedTTClass] = useState("");

  const [loading, setLoading] = useState(true);

  const isTeacher = role === "teacher";
  const isParent = role === "parent";

  useEffect(() => {
    if (!user) return;
    fetchAll();
  }, [user]);

  useEffect(() => {
    if (selectedTTClass) fetchTimetable(selectedTTClass);
  }, [selectedTTClass]);

  const fetchAll = async () => {
    setLoading(true);

    // Fetch profile
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user!.id).single();
    setProfile(prof);

    // Fetch subjects & classes
    const [subRes, classRes] = await Promise.all([
      supabase.from("subjects").select("*").order("name"),
      supabase.from("classes").select("*").order("name"),
    ]);
    if (subRes.data) setSubjects(subRes.data);
    if (classRes.data) {
      setClasses(classRes.data);
      if (classRes.data.length > 0) setSelectedTTClass(classRes.data[0].id);
    }

    if (isTeacher) {
      // Fetch students (via edge function)
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
          body: JSON.stringify({ action: "get-students" }),
        });
        const data = await res.json();
        if (data.students) setStudents(data.students);
      } catch {}

      // Fetch marks uploaded by this teacher
      const { data: marksData } = await supabase
        .from("marks")
        .select("*, subjects(name), profiles:student_id(full_name)")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (marksData) setMarks(marksData);

      // Fetch homework by this teacher
      const { data: hwData } = await supabase
        .from("homework")
        .select("*, subjects(name), classes:class_id(name)")
        .eq("teacher_id", user!.id)
        .order("due_date", { ascending: false })
        .limit(50);
      if (hwData) setHomework(hwData);
    }

    if (isParent) {
      // Fetch linked students
      const { data: links } = await supabase.from("parent_students").select("student_id").eq("parent_id", user!.id);
      if (links && links.length > 0) {
        const studentIds = links.map(l => l.student_id);
        const { data: studentProfiles } = await supabase.from("profiles").select("*").in("id", studentIds);
        if (studentProfiles) setStudents(studentProfiles);

        // Fetch marks for children
        const { data: marksData } = await supabase
          .from("marks")
          .select("*, subjects(name)")
          .in("student_id", studentIds)
          .order("created_at", { ascending: false });
        if (marksData) setMarks(marksData);

        // Fetch homework for children's classes
        const classNames = studentProfiles?.map(s => s.class_name).filter(Boolean) || [];
        if (classNames.length > 0) {
          const { data: classRows } = await supabase.from("classes").select("id").in("name", classNames);
          if (classRows && classRows.length > 0) {
            const classIds = classRows.map(c => c.id);
            const { data: hwData } = await supabase
              .from("homework")
              .select("*, subjects(name), classes:class_id(name)")
              .in("class_id", classIds)
              .order("due_date", { ascending: false });
            if (hwData) setHomework(hwData);
          }
        }
      }
    }

    // Announcements
    const { data: ann } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (ann) setAnnouncements(ann);

    setLoading(false);
  };

  const fetchTimetable = async (classId: string) => {
    const { data } = await supabase
      .from("timetable_entries")
      .select("*, subjects(name)")
      .eq("class_id", classId)
      .order("start_time");
    if (data) setTimetableData(data);
  };

  const submitMark = async () => {
    const { student_id, subject_id, mark, term, assessment_type, comment } = markForm;
    if (!student_id || !subject_id || !mark) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    setMarkLoading(true);
    const { error } = await supabase.from("marks").insert({
      student_id,
      subject_id,
      mark: parseInt(mark),
      term,
      assessment_type,
      teacher_id: user!.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Mark submitted successfully!" });
      setMarkForm({ student_id: "", subject_id: "", mark: "", term: "Term 1", assessment_type: "test", comment: "" });
      // Refresh marks
      const { data: marksData } = await supabase
        .from("marks")
        .select("*, subjects(name), profiles:student_id(full_name)")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (marksData) setMarks(marksData);
    }
    setMarkLoading(false);
  };

  const submitHomework = async () => {
    const { class_id, subject_id, title, due_date, description } = hwForm;
    if (!class_id || !subject_id || !title || !due_date) {
      toast({ title: "Fill all required fields", variant: "destructive" });
      return;
    }
    setHwLoading(true);
    const { error } = await supabase.from("homework").insert({
      class_id,
      subject_id,
      title,
      due_date,
      description: description || null,
      teacher_id: user!.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Homework posted!" });
      setHwForm({ class_id: "", subject_id: "", title: "", due_date: "", description: "" });
      const { data: hwData } = await supabase
        .from("homework")
        .select("*, subjects(name), classes:class_id(name)")
        .eq("teacher_id", user!.id)
        .order("due_date", { ascending: false })
        .limit(50);
      if (hwData) setHomework(hwData);
    }
    setHwLoading(false);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const displayName = profile?.full_name || user?.user_metadata?.full_name || "User";

  const getTimetableCell = (startTime: string, dayIndex: number) => {
    const entry = timetableData.find(
      (t) => t.start_time === startTime && (t.day_of_week === dayIndex || t.day_of_week === dayIndex + 1),
    );
    return entry?.subjects?.name || "—";
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={schoolLogo} alt="MavingTech High School" className="h-[7.5rem] w-[7.5rem] sm:h-[10.5rem] sm:w-[10.5rem] object-contain" />
            <span className="font-heading text-lg font-bold text-primary">
              {isTeacher ? "Teacher Portal" : "Parent Portal"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}><LogOut className="mr-1 h-4 w-4" /> Logout</Button>
          </div>
        </div>
      </header>

      <div className="container py-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 font-heading text-2xl font-bold text-primary">
          {isTeacher ? "Teacher Dashboard" : "Parent Dashboard"}
        </motion.h1>

        <Tabs defaultValue={isTeacher ? "upload-marks" : "view-marks"} className="space-y-6">
          <TabsList className="flex-wrap">
            {isTeacher && (
              <>
                <TabsTrigger value="upload-marks"><Upload className="mr-1 h-4 w-4" /> Upload Marks</TabsTrigger>
                <TabsTrigger value="upload-hw"><BookOpen className="mr-1 h-4 w-4" /> Upload Homework</TabsTrigger>
              </>
            )}
            <TabsTrigger value="view-marks"><BarChart3 className="mr-1 h-4 w-4" /> View Marks</TabsTrigger>
            <TabsTrigger value="view-hw"><BookOpen className="mr-1 h-4 w-4" /> Homework</TabsTrigger>
            <TabsTrigger value="timetable"><Calendar className="mr-1 h-4 w-4" /> Class Timetable</TabsTrigger>
            {isTeacher && <TabsTrigger value="my-schedule"><ClipboardList className="mr-1 h-4 w-4" /> My Schedule</TabsTrigger>}
            <TabsTrigger value="announcements"><Bell className="mr-1 h-4 w-4" /> Announcements</TabsTrigger>
          </TabsList>

          {/* Upload Marks (Teachers only) */}
          {isTeacher && (
            <TabsContent value="upload-marks">
              <Card className="max-w-lg">
                <CardHeader><CardTitle className="font-heading">Upload Student Marks</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Student *</Label>
                    <Select value={markForm.student_id} onValueChange={v => setMarkForm(p => ({ ...p, student_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                      <SelectContent>
                        {students.map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.full_name} {s.class_name ? `(${s.class_name})` : ""}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Select value={markForm.subject_id} onValueChange={v => setMarkForm(p => ({ ...p, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Term</Label>
                      <Select value={markForm.term} onValueChange={v => setMarkForm(p => ({ ...p, term: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {termOptions.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={markForm.assessment_type} onValueChange={v => setMarkForm(p => ({ ...p, assessment_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {assessmentTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Mark (%) *</Label>
                    <Input type="number" min="0" max="100" value={markForm.mark} onChange={e => setMarkForm(p => ({ ...p, mark: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Comments</Label>
                    <Textarea rows={2} value={markForm.comment} onChange={e => setMarkForm(p => ({ ...p, comment: e.target.value }))} />
                  </div>
                  <Button onClick={submitMark} disabled={markLoading} className="w-full">
                    {markLoading ? "Submitting..." : "Submit Mark"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* Upload Homework (Teachers only) */}
          {isTeacher && (
            <TabsContent value="upload-hw">
              <Card className="max-w-lg">
                <CardHeader><CardTitle className="font-heading">Post Homework</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Class *</Label>
                    <Select value={hwForm.class_id} onValueChange={v => setHwForm(p => ({ ...p, class_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                      <SelectContent>
                        {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Subject *</Label>
                    <Select value={hwForm.subject_id} onValueChange={v => setHwForm(p => ({ ...p, subject_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={hwForm.title} onChange={e => setHwForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Chapter 7 Exercises" />
                  </div>
                  <div className="space-y-2">
                    <Label>Due Date *</Label>
                    <Input type="date" value={hwForm.due_date} onChange={e => setHwForm(p => ({ ...p, due_date: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea rows={3} value={hwForm.description} onChange={e => setHwForm(p => ({ ...p, description: e.target.value }))} />
                  </div>
                  <Button onClick={submitHomework} disabled={hwLoading} className="w-full">
                    {hwLoading ? "Posting..." : "Post Homework"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {/* View Marks */}
          <TabsContent value="view-marks">
            <Card>
              <CardHeader><CardTitle className="font-heading">{isTeacher ? "Marks You've Submitted" : "Your Children's Marks"}</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                {marks.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left">Student</th>
                        <th className="px-4 py-2">Subject</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Term</th>
                        <th className="px-4 py-2">Mark</th>
                        <th className="px-4 py-2 text-left">Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {marks.map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="px-4 py-2">{(m as any).profiles?.full_name || "—"}</td>
                          <td className="px-4 py-2 text-center">{m.subjects?.name}</td>
                          <td className="px-4 py-2 text-center">{m.assessment_type}</td>
                          <td className="px-4 py-2 text-center">{m.term}</td>
                          <td className="px-4 py-2 text-center font-bold text-primary">{m.mark}%</td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{m.comment || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted-foreground italic py-8">
                    {loading ? "Loading..." : "No marks recorded yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* View Homework */}
          <TabsContent value="view-hw">
            <div className="space-y-3">
              {homework.length > 0 ? homework.map((hw) => (
                <Card key={hw.id}>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                      {(hw as any).classes?.name || "Class"} · {hw.subjects?.name || "Subject"}
                    </p>
                    <h3 className="font-semibold">{hw.title}</h3>
                    <p className="text-sm text-muted-foreground">Due: {new Date(hw.due_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</p>
                    {hw.description && <p className="mt-1 text-sm text-muted-foreground">{hw.description}</p>}
                  </CardContent>
                </Card>
              )) : (
                <p className="text-center text-muted-foreground italic py-8">
                  {loading ? "Loading..." : "No homework assigned yet."}
                </p>
              )}
            </div>
          </TabsContent>

          {/* My Schedule (Teachers only) */}
          {isTeacher && (
            <TabsContent value="my-schedule">
              <PersonalTimetableEditor title="My Teaching Schedule" />
            </TabsContent>
          )}

          {/* Class Timetable */}
          <TabsContent value="timetable">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <CardTitle className="font-heading">Class Timetable</CardTitle>
                  <Select value={selectedTTClass} onValueChange={setSelectedTTClass}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {timetableData.length > 0 ? (
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left">Time</th>
                        {days.map(d => <th key={d} className="px-3 py-2">{d}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map((slot) => (
                        <tr key={slot.start} className="border-t">
                          <td className="px-3 py-2 font-medium">{slot.start}–{slot.end}</td>
                          {days.map((_, dayIndex) => (
                            <td key={`${slot.start}-${dayIndex}`} className="px-3 py-2 text-center">{getTimetableCell(slot.start, dayIndex)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-center text-muted-foreground italic py-8">
                    {loading ? "Loading..." : "No timetable set for this class yet."}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Announcements */}
          <TabsContent value="announcements">
            <div className="space-y-3">
              {announcements.length > 0 ? announcements.map(a => (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <span className="text-xs font-semibold text-accent">{new Date(a.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <h3 className="font-heading font-semibold">{a.title}</h3>
                    {a.content && <p className="mt-1 text-sm text-muted-foreground">{a.content}</p>}
                  </CardContent>
                </Card>
              )) : (
                <p className="text-center text-muted-foreground italic py-8">No announcements.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
