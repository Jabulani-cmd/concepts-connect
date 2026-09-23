import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Clock, UserCheck, UserX, CalendarOff, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type LeaveRequest = {
  id: string;
  staff_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  staff?: { full_name: string; department: string | null; role: string | null };
};

const statusConfig: Record<string, { color: string; label: string }> = {
  pending: { color: "bg-amber-100 text-amber-800", label: "Pending" },
  approved: { color: "bg-green-100 text-green-800", label: "Approved" },
  rejected: { color: "bg-red-100 text-red-800", label: "Rejected" },
  discuss: { color: "bg-blue-100 text-blue-800", label: "Discuss" },
};

export default function StaffAvailabilityOverview() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "active" | "discuss">("active");
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leave_requests")
      .select("*, staff(full_name, department, role)")
      .order("created_at", { ascending: false });

    if (data) setRequests(data as LeaveRequest[]);
    if (error) console.error("Error fetching leave requests:", error);
    setLoading(false);
  };

  const handleAction = async (id: string, action: "approved" | "rejected" | "discuss") => {
    setUpdating(id);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("leave_requests")
      .update({ status: action, reviewed_by: user?.id || null, reviewed_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const labels = { approved: "approved", rejected: "rejected", discuss: "flagged for discussion" };
      toast({ title: `Leave request ${labels[action]}` });
      fetchRequests();
    }
    setUpdating(null);
  };

  const today = new Date().toISOString().split("T")[0];

  const filtered = requests.filter(r => {
    if (filter === "all") return true;
    if (filter === "active") {
      return r.status === "approved" && r.start_date <= today && r.end_date >= today;
    }
    return r.status === filter;
  });

  const activeLeaveCount = requests.filter(
    r => r.status === "approved" && r.start_date <= today && r.end_date >= today
  ).length;

  const pendingCount = requests.filter(r => r.status === "pending").length;
  const discussCount = requests.filter(r => r.status === "discuss").length;

  const getDaysCount = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-none shadow-maroon">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-600">{activeLeaveCount}</p>
              <p className="text-xs text-muted-foreground">Currently on Leave</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-maroon">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending Approval</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-maroon">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{discussCount}</p>
              <p className="text-xs text-muted-foreground">Needs Discussion</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-maroon">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{requests.filter(r => r.status === "approved").length}</p>
              <p className="text-xs text-muted-foreground">Total Approved</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Currently on Leave</SelectItem>
            <SelectItem value="pending">Pending Approval</SelectItem>
            <SelectItem value="discuss">Needs Discussion</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="all">All Requests</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} request(s)</span>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <CalendarOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {filter === "active" ? "No staff currently on leave." : "No leave requests found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff Member</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Leave Type</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const cfg = statusConfig[r.status] || statusConfig.pending;
                  const isActive = r.status === "approved" && r.start_date <= today && r.end_date >= today;
                  const canAct = r.status === "pending" || r.status === "discuss";
                  return (
                    <TableRow key={r.id} className={isActive ? "bg-red-50/50" : r.status === "discuss" ? "bg-blue-50/50" : ""}>
                      <TableCell className="font-medium">
                        {r.staff?.full_name || "Unknown"}
                        {isActive && <Badge variant="destructive" className="ml-2 text-[10px]">Away</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.staff?.department || "—"}</TableCell>
                      <TableCell className="capitalize">{r.leave_type.replace("_", " ")}</TableCell>
                      <TableCell className="text-xs">
                        {new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center font-medium">{getDaysCount(r.start_date, r.end_date)}</TableCell>
                      <TableCell><Badge className={cfg.color}>{cfg.label}</Badge></TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">{r.reason || "—"}</TableCell>
                      <TableCell className="text-right">
                        {canAct && (
                          <div className="flex justify-end gap-1 flex-wrap">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 border-green-300 hover:bg-green-50"
                              disabled={updating === r.id}
                              onClick={() => handleAction(r.id, "approved")}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              disabled={updating === r.id}
                              onClick={() => handleAction(r.id, "rejected")}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> Reject
                            </Button>
                            {r.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                disabled={updating === r.id}
                                onClick={() => handleAction(r.id, "discuss")}
                              >
                                <MessageSquare className="mr-1 h-3 w-3" /> Discuss
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}