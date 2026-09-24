import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CalendarOff, Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import type { Tables } from "@/integrations/supabase/types";

const leaveTypes = [
  { value: "annual", label: "Annual Leave" },
  { value: "sick", label: "Sick Leave" },
  { value: "family", label: "Family Responsibility" },
  { value: "study", label: "Study Leave" },
  { value: "compassionate", label: "Compassionate Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "other", label: "Other" },
];

const statusConfig: Record<string, { color: string; icon: typeof Clock; label?: string }> = {
  pending: { color: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejected: { color: "bg-red-100 text-red-800", icon: XCircle },
  discuss: { color: "bg-blue-100 text-blue-800", icon: Clock, label: "Discussion Required. Please see your supervisor" },
};

export default function StaffLeaveRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [requests, setRequests] = useState<Tables<"leave_requests">[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    leave_type: "annual",
    start_date: "",
    end_date: "",
    reason: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    // Get staff record for current user
    const { data: staff } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", user!.id)
      .maybeSingle();

    if (staff) {
      setStaffId(staff.id);
      const { data: reqs } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("staff_id", staff.id)
        .order("created_at", { ascending: false });
      setRequests(reqs || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchData();
  }, [fetchData, user]);

  const handleSubmit = async () => {
    if (!staffId) {
      toast({ title: "Staff record not found", description: "Your account is not linked to a staff record.", variant: "destructive" });
      return;
    }
    if (!form.start_date || !form.end_date) {
      toast({ title: "Please fill in all required dates", variant: "destructive" });
      return;
    }
    if (new Date(form.end_date) < new Date(form.start_date)) {
      toast({ title: "End date must be after start date", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leave_requests").insert({
      staff_id: staffId,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      reason: form.reason || null,
      status: "pending",
    });

    if (error) {
      toast({ title: "Failed to submit", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Leave request submitted", description: "Management will review your request." });
      setForm({ leave_type: "annual", start_date: "", end_date: "", reason: "" });
      setShowForm(false);
      fetchData();
    }
    setSubmitting(false);
  };

  const getDaysCount = (start: string, end: string) => {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)}</div>;
  }

  if (!staffId) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <CalendarOff className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Your account is not linked to a staff record. Contact administration.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-foreground">My Leave Requests</h3>
        <Button onClick={() => setShowForm(!showForm)} size="sm" variant={showForm ? "outline" : "default"}>
          <Plus className="mr-1 h-4 w-4" /> {showForm ? "Cancel" : "New Request"}
        </Button>
      </div>

      {showForm && (
        <Card className="border-secondary/30">
          <CardHeader>
            <CardTitle className="text-base">Apply for Leave</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Leave Type *</Label>
                <Select value={form.leave_type} onValueChange={v => setForm(p => ({ ...p, leave_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div />
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>End Date *</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            {form.start_date && form.end_date && new Date(form.end_date) >= new Date(form.start_date) && (
              <p className="text-xs text-muted-foreground">Duration: <span className="font-semibold text-primary">{getDaysCount(form.start_date, form.end_date)} day(s)</span></p>
            )}
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea rows={3} value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Explain the reason for your leave..." />
            </div>
            <Button onClick={handleSubmit} disabled={submitting} className="w-full">
              {submitting ? "Submitting..." : "Submit Leave Request"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Leave History */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <CalendarOff className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No leave requests yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {requests.map(r => {
            const cfg = statusConfig[r.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card key={r.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <StatusIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${r.status === "approved" ? "text-green-600" : r.status === "rejected" ? "text-red-600" : r.status === "discuss" ? "text-blue-600" : "text-amber-600"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium capitalize">{r.leave_type.replace("_", " ")} Leave</span>
                      <Badge className={cfg.color}>{cfg.label || r.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(r.start_date).toLocaleDateString()} to {new Date(r.end_date).toLocaleDateString()}
                      <span className="ml-2 font-medium">({getDaysCount(r.start_date, r.end_date)} days)</span>
                    </p>
                    {r.reason && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{r.reason}</p>}
                    {r.status === "discuss" && (
                      <p className="text-xs font-medium text-blue-700 mt-1">⚠ Please arrange a meeting with your supervisor to discuss this leave request.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
