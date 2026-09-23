import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, Circle, Rocket, Shield, Database, Users, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  description: string;
  autoCheck?: () => Promise<boolean>;
}

const CHECKLIST: ChecklistItem[] = [
  // Database & Security
  { id: "rls", category: "Security", label: "RLS policies verified on all tables", description: "All tables have Row Level Security enabled and appropriate policies." },
  { id: "auth", category: "Security", label: "Authentication tested for all roles", description: "Login/logout works for admin, teacher, student, and parent roles." },
  { id: "audit", category: "Security", label: "Audit logging active", description: "All admin actions are being recorded in the audit_logs table." },
  { id: "passwords", category: "Security", label: "Default passwords changed", description: "Admin and test account passwords have been changed from defaults." },

  // Data
  { id: "students-imported", category: "Data", label: "Student records imported", description: "All current students have been imported with correct admission numbers and forms.", autoCheck: async () => { const { count } = await supabase.from("students").select("*", { count: "exact", head: true }); return (count ?? 0) > 0; } },
  { id: "staff-imported", category: "Data", label: "Staff records imported", description: "All teaching and non-teaching staff have been imported.", autoCheck: async () => { const { count } = await supabase.from("staff").select("*", { count: "exact", head: true }); return (count ?? 0) > 0; } },
  { id: "classes-setup", category: "Data", label: "Classes configured", description: "All forms and streams (1A, 1B, etc.) have been created.", autoCheck: async () => { const { count } = await supabase.from("classes").select("*", { count: "exact", head: true }); return (count ?? 0) > 0; } },
  { id: "subjects-setup", category: "Data", label: "Subjects configured", description: "All subjects offered have been added to the system." },
  { id: "fees-setup", category: "Data", label: "Fee structures configured", description: "Current term fee structures are set for all forms and boarding statuses.", autoCheck: async () => { const { count } = await supabase.from("fee_structures").select("*", { count: "exact", head: true }).eq("is_active", true); return (count ?? 0) > 0; } },
  { id: "timetable", category: "Data", label: "Timetables configured", description: "Class timetables have been entered for the current term." },

  // Functionality
  { id: "portal-admin", category: "Functionality", label: "Admin portal fully tested", description: "All admin tabs work: announcements, user management, finance, academics, reports." },
  { id: "portal-teacher", category: "Functionality", label: "Teacher portal tested", description: "Teachers can mark attendance, upload marks, manage materials, view timetable." },
  { id: "portal-student", category: "Functionality", label: "Student portal tested", description: "Students can view results, timetable, attendance, fees, and materials." },
  { id: "portal-parent", category: "Functionality", label: "Parent portal tested", description: "Parents can view child's results, attendance, and fee status." },
  { id: "reports", category: "Functionality", label: "Reports generate correctly", description: "EMIS reports, fee reports, and attendance reports export to PDF/Excel." },
  { id: "notifications", category: "Functionality", label: "Notification system working", description: "In-app notifications deliver to correct users on events." },

  // Deployment
  { id: "domain", category: "Deployment", label: "Custom domain configured", description: "portal.mavingtech.com is pointing to the application." },
  { id: "ssl", category: "Deployment", label: "SSL certificate active", description: "HTTPS is working on the custom domain." },
  { id: "backup", category: "Deployment", label: "Backup plan in place", description: "Database backup schedule configured and tested." },
  { id: "published", category: "Deployment", label: "Application published", description: "Latest version has been published via Lovable." },

  // Training
  { id: "admin-training", category: "Training", label: "Admin staff trained", description: "School admin completed 2-hour training session." },
  { id: "teacher-training", category: "Training", label: "Teachers trained", description: "All teachers completed 2-hour training sessions." },
  { id: "bursar-training", category: "Training", label: "Bursars/Finance trained", description: "Finance staff completed 3-hour training session." },
  { id: "parent-orientation", category: "Training", label: "Parent orientation done", description: "Evening parent orientation session conducted." },
  { id: "manuals", category: "Training", label: "User manuals distributed", description: "Quick reference guides distributed to all user groups." },
];

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Security: <Shield className="h-4 w-4" />,
  Data: <Database className="h-4 w-4" />,
  Functionality: <Globe className="h-4 w-4" />,
  Deployment: <Rocket className="h-4 w-4" />,
  Training: <Users className="h-4 w-4" />,
};

export default function GoLiveChecklist() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [autoResults, setAutoResults] = useState<Record<string, boolean>>({});
  const [running, setRunning] = useState(false);

  // Load saved state
  useEffect(() => {
    const saved = localStorage.getItem("mavingtech-golive-checklist");
    if (saved) {
      try { setChecked(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  // Save on change
  useEffect(() => {
    localStorage.setItem("mavingtech-golive-checklist", JSON.stringify(checked));
  }, [checked]);

  const toggle = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const runAutoChecks = async () => {
    setRunning(true);
    const results: Record<string, boolean> = {};
    for (const item of CHECKLIST) {
      if (item.autoCheck) {
        try {
          results[item.id] = await item.autoCheck();
          if (results[item.id]) {
            setChecked((prev) => ({ ...prev, [item.id]: true }));
          }
        } catch {
          results[item.id] = false;
        }
      }
    }
    setAutoResults(results);
    setRunning(false);
  };

  const totalItems = CHECKLIST.length;
  const checkedCount = CHECKLIST.filter((i) => checked[i.id]).length;
  const progressPct = Math.round((checkedCount / totalItems) * 100);

  const categories = [...new Set(CHECKLIST.map((i) => i.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Go-Live Checklist</h2>
          <p className="text-sm text-muted-foreground">Complete all items before launching to production</p>
        </div>
        <Button onClick={runAutoChecks} disabled={running} variant="outline">
          {running ? "Checking..." : "Run Auto-Checks"}
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{checkedCount} of {totalItems} completed</span>
            <Badge variant={progressPct === 100 ? "default" : "outline"} className={progressPct === 100 ? "bg-green-600" : ""}>
              {progressPct}%
            </Badge>
          </div>
          <Progress value={progressPct} className="mt-2" />
          {progressPct === 100 && (
            <p className="mt-2 text-center text-sm font-medium text-green-600">🎉 All checks complete! Ready for go-live.</p>
          )}
        </CardContent>
      </Card>

      {categories.map((cat) => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              {CATEGORY_ICONS[cat]} {cat}
              <Badge variant="outline" className="ml-auto">
                {CHECKLIST.filter((i) => i.category === cat && checked[i.id]).length}/{CHECKLIST.filter((i) => i.category === cat).length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CHECKLIST.filter((i) => i.category === cat).map((item) => (
              <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50">
                <Checkbox id={item.id} checked={!!checked[item.id]} onCheckedChange={() => toggle(item.id)} className="mt-0.5" />
                <div className="flex-1">
                  <label htmlFor={item.id} className={`cursor-pointer text-sm font-medium ${checked[item.id] ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {item.label}
                  </label>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  {autoResults[item.id] !== undefined && (
                    <Badge variant={autoResults[item.id] ? "default" : "destructive"} className="mt-1 text-xs">
                      {autoResults[item.id] ? "✓ Auto-verified" : "✗ Not found"}
                    </Badge>
                  )}
                </div>
                {checked[item.id] ? <CheckCircle className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-muted-foreground/30" />}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
