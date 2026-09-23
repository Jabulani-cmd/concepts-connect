import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarCheck, CalendarX, Clock, CheckCircle, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  studentId: string | null;
}

const statusConfig: Record<string, { color: string; bg: string; icon: LucideIcon }> = {
  present: { color: "text-green-700", bg: "bg-green-100", icon: CheckCircle },
  absent: { color: "text-red-700", bg: "bg-red-100", icon: CalendarX },
  late: { color: "text-yellow-700", bg: "bg-yellow-100", icon: Clock },
  excused: { color: "text-blue-700", bg: "bg-blue-100", icon: CalendarCheck },
};

export default function StudentAttendanceTab({ studentId }: Props) {
  const [attendance, setAttendance] = useState<Tables<"attendance">[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState("all");

  useEffect(() => {
    if (studentId) {
      fetchAttendance();
    } else {
      setLoading(false);
    }
  }, [studentId]);

  const fetchAttendance = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("attendance")
      .select("*, classes(name)")
      .eq("student_id", studentId!)
      .order("date", { ascending: false });
    setAttendance(data || []);
    setLoading(false);
  };

  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === "present" || a.status === "late").length;
  const absentDays = attendance.filter((a) => a.status === "absent").length;
  const lateDays = attendance.filter((a) => a.status === "late").length;
  const percent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

  // Generate month options from attendance data
  const months = [...new Set(attendance.map((a) => format(new Date(a.date), "yyyy-MM")))];

  const filtered = monthFilter === "all"
    ? attendance
    : attendance.filter((a) => format(new Date(a.date), "yyyy-MM") === monthFilter);

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <Card className="border-none shadow-sm bg-gradient-to-r from-secondary/10 to-secondary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Term Attendance</p>
              <p className={`text-4xl font-bold ${percent >= 80 ? "text-green-600" : percent >= 60 ? "text-yellow-600" : "text-destructive"}`}>
                {percent}%
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-green-600">{presentDays}</p>
                <p className="text-[10px] text-muted-foreground">Present</p>
              </div>
              <div>
                <p className="text-lg font-bold text-destructive">{absentDays}</p>
                <p className="text-[10px] text-muted-foreground">Absent</p>
              </div>
              <div>
                <p className="text-lg font-bold text-yellow-600">{lateDays}</p>
                <p className="text-[10px] text-muted-foreground">Late</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <Select value={monthFilter} onValueChange={setMonthFilter}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Filter by month" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Months</SelectItem>
          {months.map((m) => (
            <SelectItem key={m} value={m}>
              {format(new Date(m + "-01"), "MMMM yyyy")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Detail List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarCheck className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No attendance records found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((a) => {
            const cfg = statusConfig[a.status] || statusConfig.present;
            const Icon = cfg.icon;
            return (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {format(new Date(a.date), "EEEE, MMM d")}
                  </p>
                  {a.notes && <p className="text-[11px] text-muted-foreground truncate">{a.notes}</p>}
                </div>
                <Badge className={`${cfg.bg} ${cfg.color} border-0 text-[10px]`}>
                  {a.status.charAt(0).toUpperCase() + a.status.slice(1)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
