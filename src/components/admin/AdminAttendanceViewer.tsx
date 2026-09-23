import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckCircle2, XCircle, Clock, AlertCircle, Users, Calendar, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function AdminAttendanceViewer() {
  const { toast } = useToast();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split("T")[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ total: 0, present: 0, absent: 0, late: 0, excused: 0 });

  useEffect(() => {
    supabase.from("classes").select("*").order("name").then(({ data }) => {
      if (data) setClasses(data);
    });
  }, []);

  const fetchAttendance = async () => {
    if (!selectedClass) {
      toast({ title: "Please select a class", variant: "destructive" });
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("attendance")
      .select("*, students:student_id(id, full_name, admission_number)")
      .eq("class_id", selectedClass)
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: false });

    if (error) {
      toast({ title: "Error fetching attendance", description: error.message, variant: "destructive" });
    } else {
      setRecords(data || []);
      const total = data?.length || 0;
      const present = data?.filter(r => r.status === "present").length || 0;
      const absent = data?.filter(r => r.status === "absent").length || 0;
      const late = data?.filter(r => r.status === "late").length || 0;
      const excused = data?.filter(r => r.status === "excused").length || 0;
      setSummary({ total, present, absent, late, excused });
    }
    setLoading(false);
  };

  const filtered = records.filter(r => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      r.students?.full_name?.toLowerCase().includes(term) ||
      r.students?.admission_number?.toLowerCase().includes(term)
    );
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "present": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "absent": return <XCircle className="h-4 w-4 text-destructive" />;
      case "late": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "excused": return <AlertCircle className="h-4 w-4 text-blue-600" />;
      default: return null;
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "present": return "default";
      case "absent": return "destructive";
      case "late": return "secondary";
      case "excused": return "outline";
      default: return "default";
    }
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const className = classes.find(c => c.id === selectedClass)?.name || "class";
    const header = "Student Name,Admission No,Date,Status,Notes\n";
    const rows = filtered.map(r =>
      `"${r.students?.full_name || ""}","${r.students?.admission_number || ""}","${r.date}","${r.status}","${r.notes || ""}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${className}_${dateFrom}_to_${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Attendance Register
          </CardTitle>
          <CardDescription>View and search attendance records by class, date range, and student name.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Class *</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>From Date</Label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To Date</Label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name or admission no..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={fetchAttendance} disabled={loading}>
              {loading ? "Loading..." : "View Attendance"}
            </Button>
            {records.length > 0 && (
              <Button variant="outline" onClick={exportCSV}>
                <Download className="mr-1 h-4 w-4" /> Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{summary.total}</p>
            <p className="text-xs text-muted-foreground">Total Records</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{summary.present}</p>
            <p className="text-xs text-muted-foreground">Present</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{summary.absent}</p>
            <p className="text-xs text-muted-foreground">Absent</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{summary.late}</p>
            <p className="text-xs text-muted-foreground">Late</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{summary.excused}</p>
            <p className="text-xs text-muted-foreground">Excused</p>
          </CardContent></Card>
        </div>
      )}

      {/* Results table */}
      {records.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">
              {filtered.length} record{filtered.length !== 1 ? "s" : ""} found
              {searchTerm && ` matching "${searchTerm}"`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Admission No</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No records match your search.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.students?.full_name || "—"}</TableCell>
                        <TableCell>{r.students?.admission_number || "—"}</TableCell>
                        <TableCell>{new Date(r.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge variant={statusBadgeVariant(r.status)} className="gap-1">
                            {statusIcon(r.status)} {r.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.notes || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {records.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-3 h-10 w-10 opacity-40" />
            <p>Select a class and date range, then click "View Attendance" to see records.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
