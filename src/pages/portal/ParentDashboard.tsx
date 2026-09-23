import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  LogOut,
  Users,
  GraduationCap,
  Calendar,
  DollarSign,
  Bell,
  TrendingUp,
  BookOpen,
  Trophy,
  Award,
  ChevronRight,
  LinkIcon,
  Plus,
  CalendarDays,
  FileText,
  Printer,
  ClipboardList,
  CreditCard,
  Search, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import schoolLogo from "@/assets/mavingtech-logo.png";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { QueryData } from "@supabase/supabase-js";
import StudentExamTimetableTab from "@/components/student/StudentExamTimetableTab";
import StudentTimetableTab from "@/components/student/StudentTimetableTab";
import StudentTermReportsTab from "@/components/student/StudentTermReportsTab";
import NotificationBell from "@/components/NotificationBell";
import StudentAnnouncementsSection from "@/components/student/StudentAnnouncementsSection";
import AccessStatusPanel from "@/components/subscription/AccessStatusPanel";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { buildReceiptHtml, buildStatementHtml, SCHOOL_LOGO_URL } from "@/lib/finance/pdf";
import { openPrintWindow } from "@/lib/finance/print";
import DocActionButtons from "@/components/finance/DocActionButtons";
import DateRangeFilter, { dateMatches, emptyDateFilter, type FinanceDateFilter } from "@/components/finance/DateRangeFilter";
import { invoiceActions, receiptActions, statementActions } from "@/lib/finance/documentActions";
import StudentMarksTab from "@/components/student/StudentMarksTab";
import { useIsMobile } from "@/hooks/use-mobile";
import PublishedTimetableWidget from "@/components/timetable/PublishedTimetableWidget";
import SubscriptionGate from "@/components/subscription/SubscriptionGate";
import PrintableSection from "@/components/shared/PrintableSection";
import PayInvoiceDialog from "@/components/finance/PayInvoiceDialog";
import { formatMoney } from "@/lib/currency";
import { errorMessage } from "@/lib/errors";
import { gradeFor, gradeBadgeClass } from "@/lib/grading";

const Locked = ({ feature, children }: { feature: string; children: React.ReactNode }) => (
  <div className="relative min-h-[60vh]">
    <SubscriptionGate feature={feature} hard>
      {children}
    </SubscriptionGate>
  </div>
);

type TabId =
  | "overview"
  | "grades"
  | "marks"
  | "timetable"
  | "attendance"
  | "fees"
  | "announcements"
  | "exam-timetable"
  | "reports";

const examResultsQuery = (examId: string, studentId: string) =>
  supabase
    .from("exam_results")
    .select("id, mark, grade, teacher_comment:comment, subject_id, subjects(name, code)")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .order("mark", { ascending: false });

type ExamResult = QueryData<ReturnType<typeof examResultsQuery>>[number];
type ChildPayment = Tables<"payments"> & { invoices?: { invoice_number: string | null } | null };
type ExamRankings = {
  overall_rank?: number;
  total_students?: number;
  subject_rankings?: Record<string, { rank: number; total: number }> | null;
};

// "billing" is a link to its own page rather than an in-page tab.
type NavItemId = TabId | "billing";

interface ChildInfo {
  id: string;
  full_name: string;
  form: string;
  stream: string | null;
  admission_number: string;
  status: string;
}

export default function ParentDashboard() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);
  const [announcements, setAnnouncements] = useState<Tables<"announcements">[]>([]);
  const [loading, setLoading] = useState(true);

  // Child-specific data
  const [attendanceData, setAttendanceData] = useState<Tables<"attendance">[]>([]);
  const [invoices, setInvoices] = useState<Tables<"invoices">[]>([]);
  const [childPayments, setChildPayments] = useState<ChildPayment[]>([]);
  const [examResults, setExamResults] = useState<ExamResult[]>([]);
  const [exams, setExams] = useState<Tables<"exams">[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<ExamRankings | null>(null);
  const [childClassId, setChildClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchInitialData();
  }, [user]);

  useEffect(() => {
    if (selectedChildId) fetchChildData(selectedChildId);
  }, [selectedChildId]);

  // Realtime payment updates
  useEffect(() => {
    if (!selectedChildId) return;
    const channel = supabase
      .channel(`parent-payments-${selectedChildId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `student_id=eq.${selectedChildId}` },
        () => {
          fetchChildData(selectedChildId);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "invoices", filter: `student_id=eq.${selectedChildId}` },
        () => {
          fetchChildData(selectedChildId);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedChildId]);

  useEffect(() => {
    if (selectedExamId && selectedChildId) fetchExamResults();
  }, [selectedExamId]);

  const fetchInitialData = async () => {
    setLoading(true);
    const uid = user!.id;

    const [{ data: prof }, { data: links }, { data: ann }] = await Promise.all([
      supabase.from("profiles").select("*").eq("user_id", uid).single(),
      supabase.from("parent_students").select("student_id").eq("parent_id", uid),
      supabase
        .from("announcements")
        .select("*")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    setProfile(prof);
    setAnnouncements(ann || []);

    if (links && links.length > 0) {
      const studentIds = links.map((l) => l.student_id);
      const { data: students } = await supabase
        .from("students")
        .select("id, full_name, form, stream, admission_number, status")
        .in("id", studentIds);

      const childList = (students || []) as ChildInfo[];
      setChildren(childList);
      if (childList.length > 0) {
        setSelectedChildId(childList[0].id);
      }
    }
    setLoading(false);
  };

  const fetchChildData = async (studentId: string) => {
    const childForm = children.find((c) => c.id === studentId)?.form;
    const [{ data: att }, { data: inv }, { data: pay }, { data: exm }, { data: sc }] = await Promise.all([
      supabase
        .from("attendance")
        .select("*")
        .eq("student_id", studentId)
        .order("date", { ascending: false }),
      supabase.from("invoices").select("*").eq("student_id", studentId).order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*, invoices(invoice_number)")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false }),
      supabase
        .from("exams")
        .select("*")
        .eq("is_published", true)
        .or(childForm ? `form_level.is.null,form_level.eq."${childForm}"` : "form_level.is.null")
        .order("academic_year", { ascending: false })
        .order("term", { ascending: false }),
      supabase.from("student_classes").select("class_id").eq("student_id", studentId).limit(1).single(),
    ]);

    setAttendanceData(att || []);
    setInvoices(inv || []);
    setChildPayments(pay || []);
    setExams(exm || []);
    setChildClassId(sc?.class_id || null);

    if (exm && exm.length > 0) {
      setSelectedExamId(exm[0].id);
    } else {
      setSelectedExamId(null);
      setExamResults([]);
      setRankings(null);
    }
  };

  const fetchExamResults = async () => {
    if (!selectedExamId || !selectedChildId) return;

    const [{ data: results }, { data: rankData }] = await Promise.all([
      examResultsQuery(selectedExamId, selectedChildId),
      supabase.rpc("get_exam_rankings", { p_exam_id: selectedExamId, p_student_id: selectedChildId }),
    ]);

    setExamResults(results || []);
    setRankings((rankData as ExamRankings | null) ?? {});
  };

  const selectedChild = children.find((c) => c.id === selectedChildId);
  const displayName = profile?.full_name || user?.user_metadata?.full_name || "Parent";

  // Computed metrics for selected child
  const attendancePercent =
    attendanceData.length > 0
      ? Math.round(
          (attendanceData.filter((a) => a.status === "present" || a.status === "late").length / attendanceData.length) *
            100,
        )
      : 0;

  const totalInvoiced = invoices.reduce((sum, inv) => sum + Number(inv.total_usd || 0), 0);
  const totalPaidAll = invoices.reduce((sum, inv) => sum + Number(inv.paid_usd || inv.amount_paid || 0), 0);
  const feeBalance = totalInvoiced - totalPaidAll; // positive = owing, negative = credit

  const avgMark =
    examResults.length > 0 ? Math.round(examResults.reduce((s, r) => s + (r.mark ?? 0), 0) / examResults.length) : 0;

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

  const tabs: { id: NavItemId; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: "Overview", icon: Users },
    { id: "grades", label: "Grades", icon: GraduationCap },
    { id: "marks", label: "Marks", icon: ClipboardList },
    { id: "timetable", label: "Timetable", icon: Calendar },
    { id: "exam-timetable", label: "Exam Timetable", icon: CalendarDays },
    { id: "reports", label: "Term Reports", icon: FileText },
    { id: "attendance", label: "Attendance", icon: Calendar },
    { id: "fees", label: "Fees", icon: DollarSign },
    { id: "announcements", label: "Announcements", icon: Bell },
    { id: "billing", label: "Billing", icon: CreditCard },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur-md">
        <div className="container flex h-20 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <img src={schoolLogo} alt="MavingTech High School" className="h-[9rem] w-[9rem] object-contain" />
            <div className="hidden sm:block">
              <span className="font-heading text-base font-bold text-foreground">Parent Portal</span>
              <p className="text-xs text-muted-foreground leading-none">{displayName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <span className="text-xs text-muted-foreground sm:hidden max-w-[120px] truncate">{displayName}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="mr-1 h-4 w-4" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="hidden md:flex">
        {/* Desktop Side Nav */}
        <aside className="sticky top-14 h-[calc(100vh-56px)] w-56 border-r bg-card p-4 space-y-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === item.id
                ? "bg-secondary text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`;
            if (item.id === "billing") {
              return (
                <Link key={item.id} to="/portal/parent/billing" className={cls}>
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            }
            const tabId = item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(tabId)} className={cls}>
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </aside>

        <main className="flex-1 p-6 max-w-4xl">
          <ChildSelector
            children={children}
            selectedChildId={selectedChildId}
            onSelect={setSelectedChildId}
            onLinked={fetchInitialData}
          />
          <AccessStatusPanel className="mt-4" />
          <TabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            child={selectedChild || null}
            childClassId={childClassId}
            attendanceData={attendanceData}
            attendancePercent={attendancePercent}
            invoices={invoices}
            childPayments={childPayments}
            feeBalance={feeBalance}
            totalInvoiced={totalInvoiced}
            totalPaidAll={totalPaidAll}
            exams={exams}
            examResults={examResults}
            selectedExamId={selectedExamId}
            setSelectedExamId={setSelectedExamId}
            rankings={rankings}
            avgMark={avgMark}
            announcements={announcements}
            refreshChildData={fetchChildData}
          />
        </main>
      </div>

      {/* Mobile */}
      <div className="md:hidden">
        <main className="container px-4 py-4 space-y-4">
          <ChildSelector
            children={children}
            selectedChildId={selectedChildId}
            onSelect={setSelectedChildId}
            onLinked={fetchInitialData}
          />
          <AccessStatusPanel />
          {/* Tab pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map((t) => {
              const cls = `rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`;
              if (t.id === "billing") {
                return <Link key={t.id} to="/portal/parent/billing" className={cls}>{t.label}</Link>;
              }
              const tabId = t.id;
              return (
                <button key={t.id} onClick={() => setActiveTab(tabId)} className={cls}>
                  {t.label}
                </button>
              );
            })}
          </div>
          <TabContent
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            child={selectedChild || null}
            childClassId={childClassId}
            attendanceData={attendanceData}
            attendancePercent={attendancePercent}
            invoices={invoices}
            childPayments={childPayments}
            feeBalance={feeBalance}
            totalInvoiced={totalInvoiced}
            totalPaidAll={totalPaidAll}
            exams={exams}
            examResults={examResults}
            selectedExamId={selectedExamId}
            setSelectedExamId={setSelectedExamId}
            rankings={rankings}
            avgMark={avgMark}
            announcements={announcements}
            refreshChildData={fetchChildData}
          />
        </main>
      </div>
    </div>
  );
}

function LinkChildDialog({ onLinked }: { onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [linking, setLinking] = useState(false);
  const { toast } = useToast();

  const handleLink = async () => {
    if (!admissionNumber.trim()) {
      toast({ title: "Please enter the admission number", variant: "destructive" });
      return;
    }
    setLinking(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-child`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          action: "link",
          admission_number: admissionNumber.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link child");
      toast({ title: "Child linked!", description: `${data.student.full_name} has been linked to your account.` });
      setOpen(false);
      setAdmissionNumber("");
      onLinked();
    } catch (err) {
      toast({ title: "Link failed", description: errorMessage(err), variant: "destructive" });
    }
    setLinking(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Link Child
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5 text-primary" /> Link Your Child
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Enter your child's admission number to link them to your parent portal.
          </p>
          <div className="space-y-2">
            <Label>Admission Number</Label>
            <Input
              placeholder="e.g. MHS-2026-001"
              value={admissionNumber}
              onChange={(e) => setAdmissionNumber(e.target.value)}
            />
          </div>
          <Button onClick={handleLink} disabled={linking} className="w-full">
            {linking ? "Linking..." : "Link Child"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChildSelector({
  children,
  selectedChildId,
  onSelect,
  onLinked,
}: {
  children: ChildInfo[];
  selectedChildId: string | null;
  onSelect: (id: string) => void;
  onLinked: () => void;
}) {
  if (children.length === 0) {
    return (
      <Card className="mb-4">
        <CardContent className="py-8 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No children linked to your account yet.</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Use your child's admission number to link them to your account.
          </p>
          <LinkChildDialog onLinked={onLinked} />
        </CardContent>
      </Card>
    );
  }

  if (children.length === 1) {
    const child = children[0];
    return (
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/10">
            <GraduationCap className="h-5 w-5 text-secondary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{child.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {child.form} {child.stream} · {child.admission_number}
            </p>
          </div>
        </div>
        <LinkChildDialog onLinked={onLinked} />
      </div>
    );
  }

  return (
    <div className="mb-4 flex items-center gap-3">
      <Select value={selectedChildId || ""} onValueChange={onSelect}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue placeholder="Select child" />
        </SelectTrigger>
        <SelectContent>
          {children.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.full_name} — {c.form} {c.stream}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LinkChildDialog onLinked={onLinked} />
    </div>
  );
}

interface TabContentProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  child: ChildInfo | null;
  childClassId: string | null;
  attendanceData: Tables<"attendance">[];
  attendancePercent: number;
  invoices: Tables<"invoices">[];
  childPayments: ChildPayment[];
  feeBalance: number;
  totalInvoiced: number;
  totalPaidAll: number;
  exams: Tables<"exams">[];
  examResults: ExamResult[];
  selectedExamId: string | null;
  setSelectedExamId: (id: string) => void;
  rankings: ExamRankings | null;
  avgMark: number;
  announcements: Tables<"announcements">[];
  refreshChildData: (studentId: string) => void;
}

const FEATURE_LABELS: Record<string, string> = {
  grades: "exam results",
  marks: "marks",
  attendance: "attendance",
  fees: "fees",
  announcements: "announcements",
  timetable: "the timetable",
  "exam-timetable": "the exam timetable",
  reports: "term reports",
};

function TabContent(props: TabContentProps) {
  const inner = <TabContentInner {...props} />;
  if (props.activeTab === "overview") return inner;
  const feature = FEATURE_LABELS[props.activeTab] || "this feature";
  return <Locked feature={feature}>{inner}</Locked>;
}

function TabContentInner(props: TabContentProps) {
  const {
    activeTab,
    setActiveTab,
    child,
    childClassId,
    attendanceData,
    attendancePercent,
    invoices,
    childPayments,
    feeBalance,
    totalInvoiced,
    totalPaidAll,
    exams,
    examResults,
    selectedExamId,
    setSelectedExamId,
    rankings,
    avgMark,
    announcements,
    refreshChildData,
  } = props;
  const isMobile = useIsMobile();
  const [feeDateFilter, setFeeDateFilter] = useState<FinanceDateFilter>(emptyDateFilter());
  const [feeSearch, setFeeSearch] = useState("");
  const [payInvoice, setPayInvoice] = useState<Tables<"invoices"> | null>(null);

  if (!child) return null;

  if (activeTab === "overview") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Viewing child:</p>
          <h1 className="text-xl font-bold">{child.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            {child.form} {child.stream} · {child.admission_number}
          </p>
        </div>

        <PublishedTimetableWidget
          title={`${child.full_name?.split(" ")[0]}'s Timetable`}
          mode="class"
          filterValue={`${child.form || ""} ${child.stream || ""}`.trim()}
          compact
        />

        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("attendance")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary/10">
                <Calendar className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-lg font-bold text-secondary">{attendancePercent}%</p>
                <p className="text-[11px] text-muted-foreground">Attendance</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("grades")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <TrendingUp className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-blue-700">{avgMark > 0 ? `${avgMark}%` : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Avg. Grade</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("grades")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-amber-700">
                  {rankings?.overall_rank ? `#${rankings.overall_rank}` : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground">Class Rank</p>
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("fees")}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                <span className="text-lg font-bold text-red-600">R</span>
              </div>
              <div>
                <p className={`text-lg font-bold ${feeBalance > 0 ? "text-red-700" : "text-emerald-700"}`}>
                  {feeBalance > 0
                    ? `${formatMoney(feeBalance)}`
                    : feeBalance < 0
                      ? `${formatMoney(Math.abs(feeBalance))} credit`
                      : formatMoney(0)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {feeBalance > 0 ? "Fee Balance" : feeBalance < 0 ? "Credit Balance" : "Fees Settled"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("grades")}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <GraduationCap className="h-5 w-5 text-secondary" />
                <span className="text-sm font-medium">View Exam Results</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setActiveTab("announcements")}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-secondary" />
                <span className="text-sm font-medium">Announcements ({announcements.length})</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>

        {/* Recent Announcements */}
        <div>
          <h3 className="text-sm font-medium mb-2">Recent Announcements</h3>
          <StudentAnnouncementsSection announcements={announcements} limit={3} />
        </div>
      </motion.div>
    );
  }

  if (activeTab === "grades") {
    const selectedExam = exams.find((e) => e.id === selectedExamId);
    const subjectRankings = rankings?.subject_rankings || {};
    const overallRank = rankings?.overall_rank ? { rank: rankings.overall_rank, total: rankings.total_students } : null;
    const avgGrade = gradeFor(avgMark);

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title={`Exam Results — ${child.full_name}`} subtitle={selectedExam ? `${selectedExam.name} — ${selectedExam.term} ${selectedExam.academic_year}` : (child.form || "")} fileName={`exam-results-${child.admission_number || child.full_name}`} bare>


        {exams.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <Award className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No published exam results yet.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Select value={selectedExamId || ""} onValueChange={setSelectedExamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select exam" />
              </SelectTrigger>
              <SelectContent>
                {exams.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name} — {e.term} {e.academic_year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {examResults.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <BookOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No results for this exam.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <Card className="bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20">
                    <CardContent className="p-3 text-center">
                      <TrendingUp className="mx-auto mb-1 h-5 w-5 text-secondary" />
                      <p className="text-lg font-bold text-secondary">{avgMark}%</p>
                      <Badge className={`mt-1 text-[10px] ${gradeBadgeClass(avgGrade)}`} variant="outline">
                        {avgGrade}
                      </Badge>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200/40">
                    <CardContent className="p-3 text-center">
                      <Trophy className="mx-auto mb-1 h-5 w-5 text-amber-600" />
                      <p className="text-lg font-bold text-amber-700">{overallRank ? overallRank.rank : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {overallRank ? `of ${overallRank.total}` : "Rank"}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/40">
                    <CardContent className="p-3 text-center">
                      <Award className="mx-auto mb-1 h-5 w-5 text-emerald-600" />
                      <p className="text-xs font-bold text-emerald-700 truncate">
                        {examResults[0]?.subjects?.name || "—"}
                      </p>
                      <p className="text-lg font-bold text-emerald-700">{examResults[0]?.mark || 0}%</p>
                      <p className="text-[10px] text-muted-foreground">Best</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Results Table */}
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Subject</th>
                            <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Mark</th>
                            <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Grade</th>
                            <th className="px-3 py-2.5 text-center font-medium text-muted-foreground hidden sm:table-cell">
                              Rank
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {examResults.map((r) => {
                            const grade = r.grade || gradeFor(r.mark);
                            const sr = r.subject_id ? subjectRankings[r.subject_id] : undefined;
                            return (
                              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                                <td className="px-3 py-3">
                                  <p className="font-medium text-foreground">{r.subjects?.name || "Unknown"}</p>
                                  {r.teacher_comment && (
                                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                                      {r.teacher_comment}
                                    </p>
                                  )}
                                </td>
                                <td className="px-3 py-3 text-center font-bold">{r.mark}%</td>
                                <td className="px-3 py-3 text-center">
                                  <Badge className={`text-xs ${gradeBadgeClass(grade)}`} variant="outline">
                                    {grade}
                                  </Badge>
                                </td>
                                <td className="px-3 py-3 text-center hidden sm:table-cell">
                                  {sr?.rank ? (
                                    <span className="text-xs">
                                      <span className="font-semibold">{sr.rank}</span>/{sr.total}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-muted/50 font-medium">
                            <td className="px-3 py-2.5">Average</td>
                            <td className="px-3 py-2.5 text-center font-bold">{avgMark}%</td>
                            <td className="px-3 py-2.5 text-center">
                              <Badge className={`text-xs ${gradeBadgeClass(avgGrade)}`} variant="outline">
                                {avgGrade}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-center hidden sm:table-cell">
                              {overallRank ? (
                                <span className="text-xs font-semibold">
                                  {overallRank.rank}/{overallRank.total}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}
        </PrintableSection>
      </motion.div>
    );
  }

  // 👇 NEW MARKS TAB
  if (activeTab === "marks") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title={`Marks — ${child.full_name}`} subtitle={`Admission ${child.admission_number || ""}`} fileName={`marks-${child.admission_number || child.full_name}`} bare>
          <StudentMarksTab studentId={child.id} />
        </PrintableSection>
      </motion.div>
    );
  }

  if (activeTab === "attendance") {
    const present = attendanceData.filter((a) => a.status === "present").length;
    const late = attendanceData.filter((a) => a.status === "late").length;
    const absent = attendanceData.filter((a) => a.status === "absent").length;
    const recentRecords = attendanceData.slice(0, 20);

    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title={`Attendance — ${child.full_name}`} subtitle={`Admission ${child.admission_number || ""}`} fileName={`attendance-${child.admission_number || child.full_name}`} bare>


        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-secondary">{attendancePercent}%</p>
              <p className="text-[10px] text-muted-foreground">Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-emerald-600">{present}</p>
              <p className="text-[10px] text-muted-foreground">Present</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-amber-600">{late}</p>
              <p className="text-[10px] text-muted-foreground">Late</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold text-red-600">{absent}</p>
              <p className="text-[10px] text-muted-foreground">Absent</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent records */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentRecords.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No attendance records found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">
                        Notes
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentRecords.map((a) => (
                      <tr key={a.id} className="border-b last:border-0">
                        <td className="px-3 py-2 text-foreground">
                          {format(new Date(a.date), "dd MMM yyyy")}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Badge
                            variant="outline"
                            className={
                              a.status === "present"
                                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                : a.status === "late"
                                  ? "bg-amber-100 text-amber-800 border-amber-300"
                                  : "bg-red-100 text-red-800 border-red-300"
                            }
                          >
                            {a.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground hidden sm:table-cell">
                          {a.notes || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        </PrintableSection>
      </motion.div>
    );
  }

  if (activeTab === "fees") {
    const q = feeSearch.trim().toLowerCase();
    const ms = (t?: string | null) => !q || (t ?? "").toString().toLowerCase().includes(q);
    const fInv = invoices.filter((i) =>
      dateMatches(feeDateFilter, i.created_at || i.due_date) &&
      (ms(i.invoice_number) || ms(i.term) || ms(i.academic_year) || ms(i.status)),
    );
    const fPay = childPayments.filter((p) =>
      dateMatches(feeDateFilter, p.payment_date) &&
      (ms(p.receipt_number) || ms(p.invoices?.invoice_number) || ms(p.payment_method) || ms(p.reference_number)),
    );
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <h2 className="text-lg font-bold">Fee Statement — {child.full_name}</h2>


        {/* Balance summary */}
        <Card className={feeBalance > 0 ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"}>
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full text-xl font-bold ${feeBalance > 0 ? "bg-red-100 text-red-600" : "bg-emerald-100 text-emerald-600"}`}>R</span>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-bold">
                {feeBalance > 0
                  ? `${formatMoney(feeBalance)} owing`
                  : feeBalance < 0
                    ? `${formatMoney(Math.abs(feeBalance))} credit`
                    : formatMoney(0)}
              </p>
              <p className="text-sm text-muted-foreground">
                {feeBalance > 0 ? "Outstanding Balance" : feeBalance < 0 ? "Credit Balance" : "No Outstanding Balance"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Total Invoiced: {formatMoney(totalInvoiced)} · Total Paid: {formatMoney(totalPaidAll)}
              </p>
            </div>
            {feeBalance > 0 && (() => {
              const owing = invoices
                .map((inv) => {
                  const paid = Number(inv.paid_usd || inv.amount_paid || 0);
                  return { inv, bal: Number(inv.total_usd || 0) - paid };
                })
                .filter((x) => x.bal > 0.001)
                .sort((a, b) => new Date(a.inv.due_date || a.inv.created_at).getTime() - new Date(b.inv.due_date || b.inv.created_at).getTime());
              const target = owing[0];
              if (!target) return null;
              return (
                <Button
                  size="lg"
                  className="bg-teal-600 hover:bg-teal-700"
                  onClick={() => setPayInvoice(target.inv)}
                >
                  <CreditCard className="w-4 h-4 mr-2" /> Pay Now
                </Button>
              );
            })()}
          </CardContent>
        </Card>

        {/* Search + date filter */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={feeSearch}
              onChange={(e) => setFeeSearch(e.target.value)}
              placeholder="Search invoice #, receipt #, term, method…"
              className="pl-9"
            />
          </div>
          <DateRangeFilter value={feeDateFilter} onChange={setFeeDateFilter} />
        </div>

        {/* Statement actions */}
        {(invoices.length > 0 || childPayments.length > 0) && (
          <DocActionButtons
            labels
            actions={statementActions(
              { fullName: child.full_name, admissionNumber: child.admission_number, form: child.form },
              fInv,
              fPay,
            )}
            email={{
              documentLabel: "Student Statement",
              filename: `statement-${(child.full_name || "student").replace(/\s+/g, "-").toLowerCase()}`,
              subject: `Statement of Account — ${child.full_name}`,
            }}
          />
        )}



        {/* Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Invoices</CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? "px-3 pb-3" : "p-0"}>
            {fInv.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No invoices found.</p>
            ) : isMobile ? (
              <div className="space-y-2">
                {fInv.map((inv) => {
                  const paid = Number(inv.paid_usd || inv.amount_paid || 0);
                  const bal = Number(inv.total_usd || 0) - paid;

                  return (
                    <Card key={inv.id} className="border">
                      <CardContent className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-medium">{inv.invoice_number}</span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                inv.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : inv.status === "partial"
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                              }
                            >
                              {inv.status}
                            </Badge>
                             <DocActionButtons labels
                              actions={() =>
                                invoiceActions(inv, {
                                  fullName: child.full_name,
                                  admissionNumber: child.admission_number,
                                  form: child.form,
                                })
                              }
                              email={{
                                documentLabel: "Invoice",
                                filename: `invoice-${inv.invoice_number}`,
                                subject: `Invoice ${inv.invoice_number} — ${child.full_name}`,
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {inv.term} {inv.academic_year}
                        </p>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="text-right font-mono">{formatMoney(inv.total_usd)}</span>

                          <span className="text-muted-foreground">Paid:</span>
                          <span className="text-right font-mono text-emerald-600">{formatMoney(paid)}</span>

                          <span className="text-muted-foreground">Balance:</span>
                          <span
                            className={`text-right font-mono ${bal < 0 ? "text-emerald-600" : bal > 0 ? "text-destructive" : ""}`}
                          >
                            {bal < 0
                              ? `+${formatMoney(Math.abs(bal))} credit`
                              : formatMoney(bal)}
                          </span>
                        </div>
                        {bal > 0.001 && (
                          <Button
                            size="sm"
                            className="w-full mt-2 bg-teal-600 hover:bg-teal-700"
                            onClick={() => setPayInvoice(inv)}
                          >
                            <CreditCard className="w-3 h-3 mr-1" /> Pay {formatMoney(bal)}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Invoice</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Term</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Total</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Paid</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Balance</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Document</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fInv.map((inv) => {
                      const paid = Number(inv.paid_usd || inv.amount_paid || 0);
                      const bal = Number(inv.total_usd || 0) - paid;
                      return (
                        <tr key={inv.id} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium text-foreground">{inv.invoice_number}</td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {inv.term} {inv.academic_year}
                          </td>
                          <td className="px-3 py-2 text-center font-mono">{formatMoney(inv.total_usd)}</td>
                          <td className="px-3 py-2 text-center text-emerald-600 font-mono">{formatMoney(paid)}</td>
                          <td
                            className={`px-3 py-2 text-center font-bold font-mono ${bal < 0 ? "text-emerald-600" : bal > 0 ? "text-red-600" : ""}`}
                          >
                            {bal < 0 ? `+${formatMoney(Math.abs(bal))}` : formatMoney(bal)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <Badge
                              variant="outline"
                              className={
                                inv.status === "paid"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                                  : inv.status === "partial"
                                    ? "bg-amber-100 text-amber-800 border-amber-300"
                                    : "bg-red-100 text-red-800 border-red-300"
                              }
                            >
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-center">
                             <DocActionButtons labels
                              actions={() =>
                                invoiceActions(inv, {
                                  fullName: child.full_name,
                                  admissionNumber: child.admission_number,
                                  form: child.form,
                                })
                              }
                              email={{
                                documentLabel: "Invoice",
                                filename: `invoice-${inv.invoice_number}`,
                                subject: `Invoice ${inv.invoice_number} — ${child.full_name}`,
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            {bal > 0.001 ? (
                              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={() => setPayInvoice(inv)}>
                                <CreditCard className="w-3 h-3 mr-1" /> Pay
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments with receipt download */}
        <ParentPaymentHistory
          childId={child.id}
          childName={child.full_name}
          admissionNumber={child.admission_number}
          form={child.form}
          refreshKey={`${childPayments.length}-${invoices.map((inv) => `${inv.id}:${inv.paid_usd}:${inv.status}`).join("|")}`}
          dateFilter={feeDateFilter}
          searchTerm={feeSearch}
        />

        {payInvoice && (
          <PayInvoiceDialog
            open={!!payInvoice}
            onOpenChange={(o) => !o && setPayInvoice(null)}
            invoice={payInvoice}
            student={{ id: child.id, full_name: child.full_name, admission_number: child.admission_number }}
            outstanding={Math.max(
              0,
              Number(payInvoice.total_usd || 0) -
                Number(payInvoice.paid_usd || payInvoice.amount_paid || 0),
            )}
            onPaid={() => {
              refreshChildData(child.id);
              window.setTimeout(() => refreshChildData(child.id), 500);
            }}
          />
        )}
      </motion.div>
    );
  }


  if (activeTab === "announcements") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title="Announcements" fileName="parent-announcements" bare>
          <StudentAnnouncementsSection announcements={announcements} />
        </PrintableSection>
      </motion.div>
    );
  }

  if (activeTab === "timetable") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title={`Class Timetable — ${child.full_name}`} subtitle={`${child.form || ""} ${child.stream || ""}`.trim()} fileName={`class-timetable-${child.admission_number || child.full_name}`} bare>
          <StudentTimetableTab studentClassId={childClassId} studentId={child.id} />
        </PrintableSection>
      </motion.div>
    );
  }

  if (activeTab === "exam-timetable") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title={`Exam Timetable — ${child.full_name}`} subtitle={child.form || ""} fileName={`exam-timetable-${child.admission_number || child.full_name}`} bare>
          <StudentExamTimetableTab studentId={child.id} formLevel={child.form} />
        </PrintableSection>
      </motion.div>
    );
  }

  if (activeTab === "reports") {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <PrintableSection title={`Term Reports — ${child.full_name}`} subtitle={`Admission ${child.admission_number || ""}`} fileName={`term-reports-${child.admission_number || child.full_name}`} bare>
          <StudentTermReportsTab />
        </PrintableSection>
      </motion.div>
    );
  }

  return null;
}

function ParentPaymentHistory({
  childId,
  childName,
  admissionNumber,
  form,
  refreshKey,
  dateFilter,
  searchTerm,
}: {
  childId: string;
  childName: string;
  admissionNumber: string;
  form: string;
  refreshKey?: string;
  dateFilter?: FinanceDateFilter;
  searchTerm?: string;
}) {
  const [payments, setPayments] = useState<ChildPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    let active = true;
    fetchPayments();
    const channel = supabase
      .channel(`parent-pay-hist-${childId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments", filter: `student_id=eq.${childId}` },
        () => {
          if (active) fetchPayments();
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [childId, refreshKey]);

  async function fetchPayments() {
    const { data } = await supabase
      .from("payments")
      .select("*, invoices(invoice_number)")
      .eq("student_id", childId)
      .order("payment_date", { ascending: false });
    setPayments(data || []);
    setLoading(false);
  }

  const docStudent = { fullName: childName, admissionNumber, form };
  const filter = dateFilter || emptyDateFilter();
  const q = (searchTerm || "").trim().toLowerCase();
  const ms = (t?: string | null) => !q || (t ?? "").toString().toLowerCase().includes(q);
  const visiblePayments = payments.filter((p) =>
    dateMatches(filter, p.payment_date) &&
    (ms(p.receipt_number) || ms(p.invoices?.invoice_number) || ms(p.payment_method) || ms(p.reference_number)),
  );
  const actionsFor = (p: ChildPayment) => receiptActions(p, docStudent);
  const emailFor = (p: ChildPayment) => ({
    documentLabel: "Receipt",
    filename: `receipt-${p.receipt_number}`,
    subject: `Official Receipt ${p.receipt_number} — ${childName}`,
  });

  if (loading) return <div className="h-20 animate-pulse rounded-lg bg-muted" />;
  if (visiblePayments.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Payment History</CardTitle>
      </CardHeader>
      <CardContent className={isMobile ? "px-3 pb-3" : "p-0"}>
        {isMobile ? (
          <div className="space-y-2">
            {visiblePayments.map((p) => (
              <Card key={p.id} className="border">
                <CardContent className="p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-medium">{p.receipt_number}</span>
                    <DocActionButtons labels actions={actionsFor(p)} email={emailFor(p)} />
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {format(new Date(p.payment_date), "dd MMM yyyy")} · {p.payment_method}
                  </p>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="text-right font-mono text-emerald-600">{formatMoney(p.amount_usd || p.amount || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Receipt</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {visiblePayments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{p.receipt_number}</td>
                    <td className="px-3 py-2">{format(new Date(p.payment_date), "dd MMM yyyy")}</td>
                    <td className="px-3 py-2 text-center text-emerald-600 font-mono">{formatMoney(p.amount_usd || p.amount || 0)}</td>
                    <td className="px-3 py-2">{p.payment_method}</td>
                    <td className="px-3 py-2 text-center">
                      <DocActionButtons labels actions={actionsFor(p)} email={emailFor(p)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
