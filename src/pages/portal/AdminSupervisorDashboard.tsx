import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { LogOut, ShieldCheck, CheckCircle, XCircle, Clock, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import schoolLogo from "@/assets/mavingtech-logo.png";
import LanguageSelect from "@/components/LanguageSelect";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import NotificationBell from "@/components/NotificationBell";

// Import all admin modules
import AcademicManagement from "@/pages/admin/AcademicManagement";
import StudentManagement from "@/pages/admin/StudentManagement";
import StaffManagementFull from "@/pages/admin/StaffManagementFull";
import BoardingManagement from "@/pages/admin/BoardingManagement";
import InventoryManagement from "@/pages/admin/InventoryManagement";
import CommunicationModule from "@/pages/admin/CommunicationModule";
import EMISReports from "@/pages/admin/EMISReports";
import AuditLogs from "@/pages/admin/AuditLogs";
import FinanceManagement from "@/pages/admin/FinanceManagement";
import UserManagement from "@/components/admin/UserManagement";
import { approvalTypeLabels, executeApprovedRequest, type ApprovalRequest } from "@/lib/finance/approvals";


export default function AdminSupervisorDashboard() {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [approvalRequests, setApprovalRequests] = useState<ApprovalRequest[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [reviewDialog, setReviewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  useEffect(() => {
    fetchApprovalRequests();

    const channel = supabase
      .channel("approval-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "finance_approval_requests" }, () => {
        fetchApprovalRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchApprovalRequests() {
    const { data } = await supabase
      .from("finance_approval_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setApprovalRequests(data);
      // Fetch requester profiles
      const userIds = [...new Set(data.map(r => r.requested_by).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        if (profs) {
          const map: Record<string, string> = {};
          profs.forEach(p => { map[p.id] = p.full_name ?? ""; });
          setProfiles(map);
        }
      }
    }
  }

  async function handleReview(action: "approved" | "rejected") {
    if (!selectedRequest) return;
    setProcessing(true);

    const { error } = await supabase
      .from("finance_approval_requests")
      .update({
        status: action,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes || null,
      })
      .eq("id", selectedRequest.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setProcessing(false);
      return;
    }

    if (action === "approved") {
      try {
        const summary = await executeApprovedRequest(selectedRequest);
        toast({ title: "Request approved", description: summary });
      } catch (e) {
        toast({ title: "Execution failed", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
      }
    } else {
      toast({ title: "Request rejected" });
    }

    // Send notification to requester
    await supabase.from("notifications").insert({
      user_id: selectedRequest.requested_by,
      title: `Approval ${action === "approved" ? "Granted" : "Denied"}`,
      message: `Your request to "${selectedRequest.description}" has been ${action}.${reviewNotes ? ` Notes: ${reviewNotes}` : ""}`,
      type: "approval",
    });

    setReviewDialog(false);
    setSelectedRequest(null);
    setReviewNotes("");
    setProcessing(false);
    fetchApprovalRequests();
  }

  const pendingCount = approvalRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="min-h-screen bg-section-warm">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-3 sm:px-4 py-2 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <img src={schoolLogo} alt="MavingTech High School" className="h-[7.5rem] w-[7.5rem] sm:h-[10.5rem] sm:w-[10.5rem] object-contain" />
            <div>
              <h1 className="font-heading text-sm sm:text-lg font-bold text-primary">Admin Supervisor</h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {pendingCount > 0 && (
              <Badge variant="destructive" className="animate-pulse text-[10px] sm:text-xs">{pendingCount}</Badge>
            )}
            <NotificationBell />
            <LanguageSelect />
            <Button variant="outline" size="sm" onClick={handleLogout} className="hidden sm:flex gap-2">
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="sm:hidden h-8 w-8"><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Tabs defaultValue="approvals">
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide mb-4 sm:mb-6">
            <TabsList className="flex flex-nowrap gap-1 w-max sm:w-auto">
              <TabsTrigger value="approvals" className="gap-1 text-xs sm:text-sm">
                <ShieldCheck className="h-3.5 w-3.5" /> Approvals {pendingCount > 0 && <Badge variant="destructive" className="ml-1 text-[10px]">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="finance" className="text-xs sm:text-sm"><DollarSign className="h-3.5 w-3.5" /> Finance</TabsTrigger>
              <TabsTrigger value="students" className="text-xs sm:text-sm">Students</TabsTrigger>
              <TabsTrigger value="staff" className="text-xs sm:text-sm">Staff</TabsTrigger>
              <TabsTrigger value="academics" className="text-xs sm:text-sm">Academics</TabsTrigger>
              <TabsTrigger value="boarding" className="text-xs sm:text-sm">Boarding</TabsTrigger>
              <TabsTrigger value="inventory" className="text-xs sm:text-sm">Inventory</TabsTrigger>
              <TabsTrigger value="communication" className="text-xs sm:text-sm">Comms</TabsTrigger>
              <TabsTrigger value="users" className="text-xs sm:text-sm">Users</TabsTrigger>
              <TabsTrigger value="reports" className="text-xs sm:text-sm">Reports</TabsTrigger>
              <TabsTrigger value="audit" className="text-xs sm:text-sm">Audit</TabsTrigger>
            </TabsList>
          </div>

          {/* Approvals Tab */}
          <TabsContent value="approvals">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card>
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-primary" /> Finance Approval Requests
                  </CardTitle>
                  <CardDescription>Review and approve/reject financial deletion and void requests from finance clerks.</CardDescription>
                </CardHeader>
                <CardContent>
                  {approvalRequests.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No approval requests yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {approvalRequests.map((req) => (
                            <TableRow key={req.id}>
                              <TableCell className="text-sm">{new Date(req.created_at).toLocaleDateString("en-GB")}</TableCell>
                              <TableCell className="text-sm font-medium">{profiles[req.requested_by] || "Unknown"}</TableCell>
                              <TableCell>
                                <Badge variant="outline">{approvalTypeLabels[req.request_type] || req.request_type}</Badge>
                              </TableCell>
                              <TableCell className="text-sm max-w-[300px] truncate">{req.description}</TableCell>
                              <TableCell>
                                {req.status === "pending" && <Badge className="bg-amber-100 text-amber-800 border-amber-300"><Clock className="h-3 w-3 mr-1" />Pending</Badge>}
                                {req.status === "approved" && <Badge className="bg-green-100 text-green-800 border-green-300"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>}
                                {req.status === "rejected" && <Badge className="bg-red-100 text-red-800 border-red-300"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>}
                              </TableCell>
                              <TableCell>
                                {req.status === "pending" && (
                                  <Button size="sm" onClick={() => { setSelectedRequest(req); setReviewNotes(""); setReviewDialog(true); }}>
                                    Review
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="finance"><FinanceManagement /></TabsContent>
          <TabsContent value="students"><StudentManagement /></TabsContent>
          <TabsContent value="staff"><StaffManagementFull /></TabsContent>
          <TabsContent value="academics"><AcademicManagement /></TabsContent>
          <TabsContent value="boarding"><BoardingManagement /></TabsContent>
          <TabsContent value="inventory"><InventoryManagement /></TabsContent>
          <TabsContent value="communication"><CommunicationModule /></TabsContent>
          <TabsContent value="users"><UserManagement /></TabsContent>
          <TabsContent value="reports"><EMISReports /></TabsContent>
          <TabsContent value="audit"><AuditLogs /></TabsContent>
        </Tabs>
      </main>

      {/* Review Dialog */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Approval Request</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Action</p>
                <p className="font-medium">{approvalTypeLabels[selectedRequest.request_type] || selectedRequest.request_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requested By</p>
                <p className="font-medium">{profiles[selectedRequest.requested_by] || "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Description</p>
                <p className="font-medium">{selectedRequest.description}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">{new Date(selectedRequest.created_at).toLocaleString("en-GB")}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Review Notes (optional)</p>
                <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add notes about your decision..." />
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
    </div>
  );
}
