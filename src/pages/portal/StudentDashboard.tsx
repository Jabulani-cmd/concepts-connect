import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, LogOut, BookOpen, ClipboardCheck, Calendar, Lock } from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import LanguageSelect from "@/components/LanguageSelect";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import NotificationBell from "@/components/NotificationBell";
import PersonalTimetableEditor from "@/components/PersonalTimetableEditor";
import StudentBottomNav from "@/components/student/StudentBottomNav";
import StudentMetricsCards from "@/components/student/StudentMetricsCards";
import StudentMaterialsTab from "@/components/student/StudentMaterialsTab";
import StudentAssessmentsTab from "@/components/student/StudentAssessmentsTab";
import StudentAttendanceTab from "@/components/student/StudentAttendanceTab";
import StudentProfileTab from "@/components/student/StudentProfileTab";
import StudentAnnouncementsSection from "@/components/student/StudentAnnouncementsSection";
import PublishedTimetableWidget from "@/components/timetable/PublishedTimetableWidget";
import StudentFeeTab from "@/components/student/StudentFeeTab";
import StudentExamResultsTab from "@/components/student/StudentExamResultsTab";
import StudentExamTimetableTab from "@/components/student/StudentExamTimetableTab";
import StudentTermReportsTab from "@/components/student/StudentTermReportsTab";
import StudentMarksTab from "@/components/student/StudentMarksTab";
import { useSubscription } from "@/hooks/useSubscription";
import PrintableSection from "@/components/shared/PrintableSection";
import AccessStatusPanel from "@/components/subscription/AccessStatusPanel";

function StudentLockedNotice({ feature, loading = false, status = "none" }: { feature: string; loading?: boolean; status?: string }) {
  const pending = status === "pending";

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md border-2 border-primary/30 bg-background shadow-lg">
        <CardContent className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
            <Lock className="h-7 w-7" />
          </div>
          <h3 className="mb-1 text-xl font-bold">
            {loading ? "Checking subscription access" : pending ? "Payment verification in progress" : "Subscription required"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Please wait while we confirm whether your portal access has been unlocked."
              : pending
              ? "Your parent or guardian's payment is being verified. Access will unlock once it is approved."
              : `Your parent or guardian must subscribe from the parent portal before you can access ${feature}.`}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

type TabId = "home" | "materials" | "assessments" | "attendance" | "profile";

export default function StudentDashboard() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("home");

  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [student, setStudent] = useState<Tables<"students"> | null>(null);
  const [studentClassId, setStudentClassId] = useState<string | null>(null);
  const [studentClassName, setStudentClassName] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<Tables<"announcements">[]>([]);
  const [loading, setLoading] = useState(true);

  // Metrics
  const [attendancePercent, setAttendancePercent] = useState(0);
  const [upcomingAssessments, setUpcomingAssessments] = useState(0);
  const [newMaterials, setNewMaterials] = useState(0);
  const [feeBalance, setFeeBalance] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const uid = user!.id;

    // Fetch profile & student record in parallel
    const [{ data: prof }, { data: studentRec }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("students").select("*").eq("user_id", uid).maybeSingle(),
    ]);

    setProfile(prof);
    setStudent(studentRec);

    // Get class ID from student_classes or profile
    let classId: string | null = null;
    if (studentRec) {
      // Try student table ID first, then auth user ID
      const { data: sc } = await supabase
        .from("student_classes")
        .select("class_id")
        .eq("student_id", studentRec.id)
        .limit(1)
        .maybeSingle();
      if (sc) {
        classId = sc.class_id;
      } else {
        // student_classes may reference auth.users ID
        const { data: sc2 } = await supabase
          .from("student_classes")
          .select("class_id")
          .eq("student_id", uid)
          .limit(1)
          .maybeSingle();
        if (sc2) classId = sc2.class_id;
      }
    }
    if (!classId && prof?.class_name) {
      const { data: c } = await supabase
        .from("classes")
        .select("id")
        .eq("name", prof.class_name)
        .maybeSingle();
      if (c) classId = c.id;
    }
    setStudentClassId(classId);

    // Fetch class name
    if (classId) {
      const { data: classData } = await supabase.from("classes").select("name").eq("id", classId).single();
      setStudentClassName(classData?.name || null);
    } else {
      setStudentClassName(null);
    }

    // Fetch metrics in parallel
    const studentTableId = studentRec?.id;
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const none = Promise.resolve({ data: null });

    const [annRes, attRes, invRes, upcomingRes, materialsRes] = await Promise.all([
      supabase.from("announcements").select("*").eq("is_public", true).order("created_at", { ascending: false }).limit(20),
      studentTableId ? supabase.from("attendance").select("status").eq("student_id", studentTableId) : none,
      studentTableId ? supabase.from("invoices").select("total_usd, paid_usd").eq("student_id", studentTableId) : none,
      classId
        ? supabase.from("assessments").select("id").eq("class_id", classId).eq("is_published", true).gte("due_date", today)
        : none,
      classId
        ? supabase.from("study_materials").select("id").eq("class_id", classId).eq("is_published", true).gte("created_at", weekAgo)
        : none,
    ]);

    setAnnouncements(annRes.data || []);

    const attData = attRes.data || [];
    if (attData.length > 0) {
      const present = attData.filter((a) => a.status === "present" || a.status === "late").length;
      setAttendancePercent(Math.round((present / attData.length) * 100));
    }

    const invData = invRes.data || [];
    if (invData.length > 0) {
      setFeeBalance(invData.reduce((sum, i) => sum + (i.total_usd - i.paid_usd), 0));
    }

    if (classId) {
      setUpcomingAssessments(upcomingRes.data?.length || 0);
      setNewMaterials(materialsRes.data?.length || 0);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [fetchData, user]);

  const displayName = student?.full_name || profile?.full_name || user?.user_metadata?.full_name || "Student";

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-md">
        <div className="container flex h-20 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={schoolLogo} alt="MavingTech High School" className="h-[7.5rem] w-[7.5rem] sm:h-[10.5rem] sm:w-[10.5rem] object-contain" />
            <span className="font-heading text-base font-bold text-foreground hidden sm:inline">Student Portal</span>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <LanguageSelect />
            <span className="text-xs text-muted-foreground hidden sm:inline max-w-[120px] truncate">{displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden md:flex">
              <LogOut className="mr-1 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop Side Nav */}
      <div className="hidden md:flex">
        <aside className="sticky top-14 h-[calc(100vh-56px)] w-56 border-r bg-card p-4 space-y-1">
          {[
            { id: "home" as TabId, label: "Dashboard", icon: User },
            { id: "materials" as TabId, label: "Study Materials", icon: BookOpen },
            { id: "assessments" as TabId, label: "Assessments", icon: ClipboardCheck },
            { id: "attendance" as TabId, label: "Attendance", icon: Calendar },
            { id: "profile" as TabId, label: "Profile", icon: User },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  activeTab === item.id
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>

        <main className="flex-1 p-6 max-w-4xl">
          <TabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            displayName={displayName}
            profile={profile}
            student={student}
            studentClassId={studentClassId}
            studentClassName={studentClassName}
            announcements={announcements}
            attendancePercent={attendancePercent}
            upcomingAssessments={upcomingAssessments}
            newMaterials={newMaterials}
            feeBalance={feeBalance}
            userId={user!.id}
            onRefresh={fetchData}
          />
        </main>
      </div>

      {/* Mobile Content */}
      <div className="md:hidden">
        <main className="container px-4 py-4">
          <TabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            displayName={displayName}
            profile={profile}
            student={student}
            studentClassId={studentClassId}
            studentClassName={studentClassName}
            announcements={announcements}
            attendancePercent={attendancePercent}
            upcomingAssessments={upcomingAssessments}
            newMaterials={newMaterials}
            feeBalance={feeBalance}
            userId={user!.id}
            onRefresh={fetchData}
          />
        </main>
        <StudentBottomNav activeTab={activeTab} onTabChange={(t) => setActiveTab(t as TabId)} />
      </div>
    </div>
  );
}

interface TabContentProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  displayName: string;
  profile: Tables<"profiles"> | null;
  student: Tables<"students"> | null;
  studentClassId: string | null;
  studentClassName: string | null;
  announcements: Tables<"announcements">[];
  attendancePercent: number;
  upcomingAssessments: number;
  newMaterials: number;
  feeBalance: number | null;
  userId: string;
  onRefresh: () => void;
}

function TabContent({
  activeTab, setActiveTab, displayName, profile, student, studentClassId, studentClassName,
  announcements, attendancePercent, upcomingAssessments, newMaterials, feeBalance,
  userId, onRefresh,
}: TabContentProps) {
  const [homeSubTab, setHomeSubTab] = useState<"overview" | "timetable" | "planner" | "fees" | "announcements" | "marks" | "results" | "exam-timetable" | "reports">("overview");
  const subscription = useSubscription();
  const renderLocked = (feature: string, children: React.ReactNode) => {
    if (subscription.loading || !subscription.isActive) {
      return <StudentLockedNotice feature={feature} loading={subscription.loading} status={subscription.status} />;
    }
    return children;
  };

  if (activeTab === "home") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        {/* Welcome */}
        <div>
          <h1 className="text-xl font-bold">Welcome, {displayName.split(" ")[0]}!</h1>
          <p className="text-sm text-muted-foreground">
            {student?.form} {student?.stream} · {student?.admission_number}
          </p>
        </div>

        {/* Metrics */}
        <StudentMetricsCards
          attendancePercent={attendancePercent}
          upcomingAssessments={upcomingAssessments}
          newMaterials={newMaterials}
          feeBalance={feeBalance}
        />

        <AccessStatusPanel />

        {/* Quick Nav Sections */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { id: "overview" as const, label: "Overview" },
            { id: "timetable" as const, label: "Timetable" },
            { id: "planner" as const, label: "My Planner" },
            { id: "announcements" as const, label: "Announcements" },
            { id: "marks" as const, label: "Marks" },
            { id: "results" as const, label: "Exam Results" },
            { id: "exam-timetable" as const, label: "Exam Timetable" },
            { id: "reports" as const, label: "Term Reports" },
            { id: "fees" as const, label: "Fees" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setHomeSubTab(t.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                homeSubTab === t.id
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {homeSubTab === "overview" && (
          <div className="space-y-4">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("materials")}>
                <BookOpen className="h-5 w-5 text-secondary" />
                <span className="text-xs">Materials</span>
              </Button>
              <Button variant="outline" className="h-auto py-3 flex-col gap-1" onClick={() => setActiveTab("assessments")}>
                <ClipboardCheck className="h-5 w-5 text-secondary" />
                <span className="text-xs">Assessments</span>
              </Button>
            </div>

            {/* Recent Announcements */}
            <div>
              <h3 className="text-sm font-medium mb-2">Recent Announcements</h3>
              <StudentAnnouncementsSection announcements={announcements} limit={3} />
            </div>
          </div>
        )}

        {homeSubTab === "timetable" && renderLocked("the timetable", <PrintableSection title="My Class Timetable" subtitle={`${student?.form || ""} ${student?.stream || ""}`.trim()} fileName={`timetable-${student?.admission_number || "student"}`} bare><PublishedTimetableWidget title="My Class Timetable" mode="class" filterValue={`${student?.form || ""} ${student?.stream || ""}`.trim()} /></PrintableSection>)}
        {homeSubTab === "planner" && renderLocked("the planner", <PrintableSection title="My Personal Planner" fileName={`planner-${student?.admission_number || "student"}`} bare><PersonalTimetableEditor title="My Personal Planner" /></PrintableSection>)}
        {homeSubTab === "announcements" && renderLocked("announcements", <PrintableSection title="Announcements" fileName="announcements" bare><StudentAnnouncementsSection announcements={announcements} /></PrintableSection>)}
        {homeSubTab === "marks" && renderLocked("marks", <PrintableSection title="My Marks" subtitle={student?.full_name || displayName} fileName={`marks-${student?.admission_number || "student"}`} bare><StudentMarksTab studentId={student?.id} /></PrintableSection>)}
        {homeSubTab === "results" && (
          renderLocked("exam results",
            <PrintableSection title="Exam Results" subtitle={student?.full_name || displayName} fileName={`exam-results-${student?.admission_number || "student"}`} bare>
              <StudentExamResultsTab
                studentId={student?.id}
                studentName={student?.full_name || displayName}
                admissionNumber={student?.admission_number}
                form={student?.form}
                stream={student?.stream}
              />
            </PrintableSection>
          )
        )}
        {homeSubTab === "fees" && renderLocked("fees", <StudentFeeTab studentId={student?.id} />)}
        {homeSubTab === "exam-timetable" && renderLocked("the exam timetable", <PrintableSection title="Exam Timetable" subtitle={student?.form || ""} fileName={`exam-timetable-${student?.admission_number || "student"}`} bare><StudentExamTimetableTab studentId={student?.id} formLevel={student?.form} /></PrintableSection>)}
        {homeSubTab === "reports" && renderLocked("term reports", <PrintableSection title="Term Reports" subtitle={student?.full_name || displayName} fileName={`term-reports-${student?.admission_number || "student"}`} bare><StudentTermReportsTab /></PrintableSection>)}
      </motion.div>
    );
  }

  if (activeTab === "materials") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {renderLocked("study materials",
          <PrintableSection title="Study Materials" fileName="study-materials" bare hideActions>
            <StudentMaterialsTab studentClassId={studentClassId} />
          </PrintableSection>
        )}
      </motion.div>
    );
  }

  if (activeTab === "assessments") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {renderLocked("assessments",
          <PrintableSection title="Assessments" subtitle={student?.full_name || displayName} fileName={`assessments-${student?.admission_number || "student"}`} bare>
            <StudentAssessmentsTab studentId={student?.id} studentClassId={studentClassId} userId={userId} />
          </PrintableSection>
        )}
      </motion.div>
    );
  }

  if (activeTab === "attendance") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {renderLocked("attendance",
          <PrintableSection title="Attendance Record" subtitle={student?.full_name || displayName} fileName={`attendance-${student?.admission_number || "student"}`} bare>
            <StudentAttendanceTab studentId={student?.id} />
          </PrintableSection>
        )}
      </motion.div>
    );
  }

  if (activeTab === "profile") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {renderLocked("your profile",
          <PrintableSection title="Student Profile" subtitle={student?.full_name || displayName} fileName={`profile-${student?.admission_number || "student"}`} bare>
            <StudentProfileTab profile={profile} student={student} studentClassName={studentClassName} onRefresh={onRefresh} />
          </PrintableSection>
        )}
      </motion.div>
    );
  }

  return null;
}
