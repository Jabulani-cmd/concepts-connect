// Bursar-facing approvals panel - reviews void / delete requests submitted by
// Finance Clerks, then executes the approved action against the underlying
// finance tables. Extracted so it can live inside the Bursar Portal without
// dragging in the rest of the AdminSupervisorDashboard.
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, CheckCircle, XCircle, Clock, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { approvalTypeLabels, executeApprovedRequest, type ApprovalRequest } from "@/lib/finance/approvals";

export default function FinanceApprovalsPanel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selected, setSelected] = useState<ApprovalRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel(`bursar-approvals-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "finance_approval_requests" },
        () => fetchRequests(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchRequests() {
    const { data } = await supabase
      .from("finance_approval_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) return;
    setRequests(data);
    const ids = [...new Set(data.map(r => r.requested_by).filter(Boolean))];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      if (profs) {
        const map: Record<string, string> = {};
        profs.forEach(p => {
          map[p.id] = p.full_name || p.email || "Unknown";
        });
        setProfiles(map);
      }
    }
  }

  async function handleReview(action: "approved" | "rejected") {
    if (!selected) return;
    setProcessing(true);

    const { error } = await supabase
      .from("finance_approval_requests")
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq("id", selected.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setProcessing(false);
      return;
    }

    if (action === "approved") {
      try {
        const summary = await executeApprovedRequest(selected);
        toast({ title: "Request approved", description: summary });
      } catch (e) {
        toast({ title: "Execution failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      }
    } else {
      toast({ title: "Request rejected" });
    }

    // Notify the requester (Finance Clerk).
    await supabase.from("notifications").insert({
      user_id: selected.requested_by,
      title: `Approval ${action === "approved" ? "Granted" : "Denied"}: Bursar`,
      message: `Your request to "${selected.description}" has been ${action}.${reviewNotes ? ` Notes: ${reviewNotes}` : ""}`,
      type: "approval",
    });

    setReviewDialog(false);
    setSelected(null);
    setReviewNotes("");
    setProcessing(false);
    fetchRequests();
  }

  const filtered = requests.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const haystack = `${r.description} ${r.request_type} ${r.target_table ?? ""} ${profiles[r.requested_by] || ""}`.toLowerCase();
      if (!haystack.includes(s)) return false;
    }
    return true;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" /> Finance Clerk Approval Queue
        </CardTitle>
        <CardDescription>
          Review, approve or reject deletion and void requests submitted by Finance Clerks. As the Bursar
          you are the only finance authority who can release these actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md border bg-amber-50 p-2">
            <div className="font-bold text-amber-700 text-lg">{pendingCount}</div>
            <div className="text-amber-700/80">Pending</div>
          </div>
          <div className="rounded-md border bg-emerald-50 p-2">
            <div className="font-bold text-emerald-700 text-lg">{approvedCount}</div>
            <div className="text-emerald-700/80">Approved</div>
          </div>
          <div className="rounded-md border bg-red-50 p-2">
            <div className="font-bold text-red-700 text-lg">{rejectedCount}</div>
            <div className="text-red-700/80">Rejected</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by clerk, action, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-full sm:w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending only</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="all">All requests</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground text-sm">
            No requests match the current filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Finance Clerk</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="text-xs">
                      {new Date(req.created_at).toLocaleString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {profiles[req.requested_by] || "Unknown clerk"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{approvalTypeLabels[req.request_type] || req.request_type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{req.description}</TableCell>
                    <TableCell>
                      {req.status === "pending" && (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                          <Clock className="h-3 w-3 mr-1" /> Pending
                        </Badge>
                      )}
                      {req.status === "approved" && (
                        <Badge className="bg-green-100 text-green-800 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" /> Approved
                        </Badge>
                      )}
                      {req.status === "rejected" && (
                        <Badge className="bg-red-100 text-red-800 border-red-300">
                          <XCircle className="h-3 w-3 mr-1" /> Rejected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelected(req);
                            setReviewNotes("");
                            setReviewDialog(true);
                          }}
                        >
                          Review
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString("en-GB") : "-"}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bursar Review</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Requested action</p>
                <p className="font-medium">
                  {approvalTypeLabels[selected.request_type] || selected.request_type}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Submitted by</p>
                <p className="font-medium">{profiles[selected.requested_by] || "Unknown clerk"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Description</p>
                <p className="font-medium">{selected.description}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Submitted at</p>
                <p className="font-medium">
                  {new Date(selected.created_at).toLocaleString("en-GB")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Bursar notes (optional)</p>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add an audit note about your decision…"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="destructive" onClick={() => handleReview("rejected")} disabled={processing}>
              <XCircle className="h-4 w-4 mr-1" /> Reject
            </Button>
            <Button onClick={() => handleReview("approved")} disabled={processing}>
              <CheckCircle className="h-4 w-4 mr-1" /> Approve & Execute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
