import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Users, GraduationCap, BookOpen, Briefcase, ClipboardList, Bell, CheckCircle2, UserCheck, Layers, CalendarOff, Bot } from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import LanguageSelect from "@/components/LanguageSelect";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import AcademicManagement from "@/pages/admin/AcademicManagement";
import AdminAttendanceViewer from "@/components/admin/AdminAttendanceViewer";
import StudentManagement from "@/pages/admin/StudentManagement";
import StaffManagement from "@/components/admin/StaffManagement";
import StaffManagementFull from "@/pages/admin/StaffManagementFull";
import EMISReports from "@/pages/admin/EMISReports";
import TeacherDashboard from "@/pages/portal/TeacherDashboard";
import StaffAvailabilityOverview from "@/components/admin/StaffAvailabilityOverview";
import AgentFindingsPanel from "@/components/agent/AgentFindingsPanel";

export default function HODDashboard() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ students: 0, staff: 0, announcements: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      const [studentsRes, staffRes, annRes] = await Promise.all([
        supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("staff").select("id", { count: "exact", head: true }),
        supabase.from("announcements").select("id", { count: "exact", head: true }),
      ]);
      setStats({ students: studentsRes.count || 0, staff: staffRes.count || 0, announcements: annRes.count || 0 });
    };
    fetchStats();
  }, []);

  const handleLogout = async () => { await signOut(); navigate("/login"); };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
        <div className="container flex h-14 sm:h-20 items-center justify-between px-3 sm:px-4">
          <div className="flex items-center gap-2">
            <img src={schoolLogo} alt="MavingTech High School" className="h-auto w-24 object-contain sm:w-40" />
            <span className="font-heading text-sm sm:text-lg font-bold text-primary">HOD Portal</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-sm text-muted-foreground">Head of Department</span>
            <LanguageSelect />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="hidden sm:flex"><LogOut className="mr-1 h-4 w-4" /> Logout</Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden h-8 w-8"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container px-3 sm:px-4 py-4 sm:py-8">
        <motion.h1 initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4 sm:mb-6 font-heading text-lg sm:text-2xl font-bold text-primary">
          HOD Dashboard
        </motion.h1>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Active Students", value: String(stats.students), icon: GraduationCap },
            { label: "Staff Members", value: String(stats.staff), icon: Users },
            { label: "Announcements", value: String(stats.announcements), icon: Bell },
          ].map((s, i) => (
            <Card key={i} className="border-none shadow-maroon">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-maroon-light">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="teaching" className="space-y-4 sm:space-y-6">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
          <TabsList className="flex-wrap h-auto gap-1 w-max sm:w-auto">
            <TabsTrigger value="teaching" className="text-xs sm:text-sm"><Layers className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> My Teaching</TabsTrigger>
            <TabsTrigger value="agent" className="text-xs sm:text-sm"><Bot className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Agent Alerts</TabsTrigger>
            <TabsTrigger value="academics" className="text-xs sm:text-sm"><GraduationCap className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Academics</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs sm:text-sm"><CheckCircle2 className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Attendance</TabsTrigger>
            <TabsTrigger value="reports" className="text-xs sm:text-sm"><ClipboardList className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Reports</TabsTrigger>
            <TabsTrigger value="students" className="text-xs sm:text-sm"><BookOpen className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Students</TabsTrigger>
            <TabsTrigger value="staff" className="text-xs sm:text-sm"><UserCheck className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Staff</TabsTrigger>
            <TabsTrigger value="directory" className="text-xs sm:text-sm"><Briefcase className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Directory</TabsTrigger>
            <TabsTrigger value="staff-leave" className="text-xs sm:text-sm"><CalendarOff className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" /> Staff Leave</TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="teaching"><TeacherDashboard embedded /></TabsContent>
          <TabsContent value="agent"><AgentFindingsPanel title="Department agent alerts" description="Everything the school agent has raised: learners needing support, registers not taken, marks overdue. Follow up with class teachers where items stay open." /></TabsContent>
          <TabsContent value="academics"><AcademicManagement /></TabsContent>
          <TabsContent value="attendance"><AdminAttendanceViewer /></TabsContent>
          <TabsContent value="reports"><EMISReports /></TabsContent>
          <TabsContent value="students"><StudentManagement /></TabsContent>
          <TabsContent value="staff"><StaffManagement /></TabsContent>
          <TabsContent value="directory"><StaffManagementFull /></TabsContent>
          <TabsContent value="staff-leave"><StaffAvailabilityOverview /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
