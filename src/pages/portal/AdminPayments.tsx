import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, DollarSign, Users, Clock, AlertTriangle, Sparkles, Search, CheckCircle2, XCircle, Pause, Gift, Plus, Bell, FileSpreadsheet, TrendingUp, Loader2, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatMoney } from "@/lib/currency";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import type { Tables } from "@/integrations/supabase/types";

const PIE_COLORS = ["#0d9488", "#2563eb", "#7c3aed", "#f59e0b", "#ef4444", "#0ea5e9"];

export default function AdminPayments() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [subs, setSubs] = useState<(Tables<"subscriptions"> & { subscription_plans?: { name: string } | null })[]>([]);
  const [payments, setPayments] = useState<Tables<"payments">[]>([]);
  const [grants, setGrants] = useState<Tables<"access_grants">[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantForm, setGrantForm] = useState({ studentId: "", parentId: "", reason: "Staff Child", days: 90 });

  async function refresh() {
    const [{ data: s }, { data: p }, { data: g }] = await Promise.all([
      supabase.from("subscriptions").select("*, subscription_plans(name)").order("created_at", { ascending: false }),
      supabase.from("payments").select("*").order("created_at", { ascending: false }),
      supabase.from("access_grants").select("*").order("created_at", { ascending: false }),
    ]);
    setSubs(s || []);
    setPayments(p || []);
    setGrants(g || []);
  }

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("admin-pay-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // ── derived metrics ─────────────────────────────────────────────────
  const now = new Date();
  const totalRevenueTerm = useMemo(
    () => payments.filter((p) => p.payment_status === "paid").reduce((s, p) => s + Number(p.amount), 0),
    [payments],
  );
  const totalRevenueMonth = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return payments
      .filter((p) => p.payment_status === "paid" && new Date(p.created_at) >= start)
      .reduce((s, p) => s + Number(p.amount), 0);
  }, [payments]);
  const activeCount = subs.filter((s) => s.status === "active").length;
  const expiredCount = subs.filter((s) => s.status === "expired" || (s.access_end && new Date(s.access_end) < now && s.status !== "complimentary")).length;
  const pendingVerifications = payments.filter((p) => p.payment_status === "awaiting_verification").length;

  const monthlyChart = useMemo(() => {
    const months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en", { month: "short" }), total: 0 };
    });
    payments.forEach((p) => {
      if (p.payment_status !== "paid") return;
      const d = new Date(p.created_at);
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const row = months.find((m) => m.key === k);
      if (row) row.total += Number(p.amount);
    });
    return months;
  }, [payments]);

  const methodChart = useMemo(() => {
    const map: Record<string, number> = {};
    payments.filter((p) => p.payment_status === "paid").forEach((p) => {
      map[p.payment_method] = (map[p.payment_method] || 0) + Number(p.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name: name.replace("_", " "), value }));
  }, [payments]);

  // ── filters ──────────────────────────────────────────────────────────
  const filtered = subs.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (search && !JSON.stringify(s).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // ── actions ──────────────────────────────────────────────────────────
  async function verifyPayment(paymentId: string, subId: string, approve: boolean) {
    if (approve) {
      const { data: payRow } = await supabase.from("payments").select("*, subscriptions(*)").eq("id", paymentId).maybeSingle();
      if (!payRow) return;
      const accessEnd = new Date(Date.now() + 90 * 86_400_000);
      await supabase.from("payments").update({
        payment_status: "paid",
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      }).eq("id", paymentId);
      await supabase.from("subscriptions").update({
        status: "active",
        access_start: new Date().toISOString(),
        access_end: accessEnd.toISOString(),
      }).eq("id", subId);
      await supabase.from("access_grants").insert({
        parent_id: payRow.parent_id,
        student_id: payRow.subscriptions?.student_id,
        grant_type: "paid",
        access_start: new Date().toISOString(),
        access_end: accessEnd.toISOString(),
        subscription_id: subId,
        is_active: true,
        granted_by: user?.id,
      });
      toast({ title: "Payment approved", description: "Access has been activated." });
    } else {
      await supabase.from("payments").update({
        payment_status: "rejected",
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
        rejection_reason: "Verification failed",
      }).eq("id", paymentId);
      toast({ title: "Payment rejected", description: "Parent has been notified.", variant: "destructive" });
    }
    refresh();
  }

  async function suspend(subId: string) {
    await supabase.from("subscriptions").update({ status: "suspended" }).eq("id", subId);
    toast({ title: "Subscription suspended" });
    refresh();
  }

  async function extend(subId: string, days: number) {
    const s = subs.find((x) => x.id === subId);
    if (!s) return;
    const base = s.access_end ? new Date(s.access_end) : new Date();
    const end = new Date(Math.max(base.getTime(), Date.now()) + days * 86_400_000);
    await supabase.from("subscriptions").update({ status: "active", access_end: end.toISOString() }).eq("id", subId);
    toast({ title: `Extended by ${days} days` });
    refresh();
  }

  async function generateAiReminder() {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-parent-message", {
        body: {
          intent: "payment_reminder",
          context: `There are ${expiredCount + subs.filter(s => s.status === "pending").length} unpaid families. Write a warm, brief reminder to renew portal subscription at MavingTech Business Solutions. Mention plans start at US$ 10/month or US$ 25/term, with the current ZiG equivalent shown in the portal.`,
        },
      });
      if (error) throw error;
      setAiMessage(data?.message || data?.text || "Dear Parent, this is a friendly reminder to renew your portal subscription so your child can continue accessing learning materials and the timetable.");
    } catch {
      setAiMessage("Dear Parent, this is a friendly reminder to renew your portal subscription so your child can continue accessing learning materials and the timetable. Plans start at US$ 10/month or US$ 25/term, with the current ZiG equivalent shown in the portal. — MavingTech Business Solutions");
    } finally {
      setAiLoading(false);
    }
  }

  async function sendReminders() {
    const unpaid = subs.filter((s) => s.status !== "active" && s.status !== "complimentary");
    if (!unpaid.length) {
      toast({ title: "Nothing to send", description: "All families are paid up." });
      return;
    }
    const rows = unpaid.map((s) => ({
      parent_id: s.parent_id,
      student_id: s.student_id,
      reminder_type: "renewal",
      delivery_method: "in_app",
      ai_generated_message: aiMessage,
      created_by: user?.id,
    }));
    await supabase.from("payment_reminders").insert(rows);
    toast({ title: `Reminders sent to ${rows.length} families` });
    setAiOpen(false);
  }

  async function grantComplimentary() {
    if (!grantForm.parentId || !grantForm.studentId) {
      toast({ title: "Parent and student IDs are required", variant: "destructive" });
      return;
    }
    await supabase.from("access_grants").insert({
      parent_id: grantForm.parentId,
      student_id: grantForm.studentId,
      grant_type: "complimentary",
      reason: grantForm.reason,
      access_start: new Date().toISOString(),
      access_end: new Date(Date.now() + grantForm.days * 86_400_000).toISOString(),
      granted_by: user?.id,
      is_active: true,
    });
    toast({ title: "Complimentary access granted" });
    setGrantOpen(false);
    refresh();
  }

  // ── render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Button variant="ghost" onClick={() => nav(-1)} className="mb-3"><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Parent Payments</h1>
            <p className="text-muted-foreground text-sm">Subscriptions, verifications, revenue and reminders.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={aiOpen} onOpenChange={setAiOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90">
                  <Sparkles className="w-4 h-4 mr-2" /> Send Reminders ✨
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>AI-Drafted Payment Reminder</DialogTitle></DialogHeader>
                <Button variant="outline" onClick={generateAiReminder} disabled={aiLoading}>
                  {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  {aiMessage ? "Regenerate" : "Generate message"}
                </Button>
                <Textarea value={aiMessage} onChange={(e) => setAiMessage(e.target.value)} rows={6} placeholder="Reminder message..." />
                <DialogFooter>
                  <Button onClick={sendReminders} disabled={!aiMessage}>
                    <Bell className="w-4 h-4 mr-2" /> Send to all unpaid families
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Gift className="w-4 h-4 mr-2" /> Grant Complimentary</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Grant Complimentary Access</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Parent user ID</Label><Input value={grantForm.parentId} onChange={(e) => setGrantForm({ ...grantForm, parentId: e.target.value })} /></div>
                  <div><Label>Student user ID</Label><Input value={grantForm.studentId} onChange={(e) => setGrantForm({ ...grantForm, studentId: e.target.value })} /></div>
                  <div>
                    <Label>Reason</Label>
                    <Select value={grantForm.reason} onValueChange={(v) => setGrantForm({ ...grantForm, reason: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Staff Child">Staff Child</SelectItem>
                        <SelectItem value="Scholarship">Scholarship</SelectItem>
                        <SelectItem value="Hardship Case">Hardship Case</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Days valid</Label><Input type="number" value={grantForm.days} onChange={(e) => setGrantForm({ ...grantForm, days: Number(e.target.value) })} /></div>
                </div>
                <DialogFooter><Button onClick={grantComplimentary}><Gift className="w-4 h-4 mr-2" />Grant</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Metric icon={DollarSign} label="Revenue (term)" value={formatMoney(totalRevenueTerm)} tint="from-emerald-500 to-teal-600" />
          <Metric icon={TrendingUp} label="Revenue (month)" value={formatMoney(totalRevenueMonth)} tint="from-teal-500 to-cyan-600" />
          <Metric icon={Users} label="Active subs" value={activeCount} tint="from-blue-500 to-indigo-600" />
          <Metric icon={AlertTriangle} label="Expired" value={expiredCount} tint="from-amber-500 to-orange-600" />
          <Metric icon={Clock} label="Pending verify" value={pendingVerifications} tint="from-purple-500 to-pink-600" />
          <Metric icon={Gift} label="Comp grants" value={grants.filter((g) => g.grant_type === "complimentary" && g.is_active).length} tint="from-rose-500 to-pink-600" />
        </div>

        <Tabs defaultValue="subs">
          <TabsList>
            <TabsTrigger value="subs">Subscriptions</TabsTrigger>
            <TabsTrigger value="verify">Verify ({pendingVerifications})</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="subs">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle>Parent payment status</CardTitle>
                  <div className="flex gap-2">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input placeholder="Search…" className="pl-8 w-56" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="suspended">Suspended</SelectItem>
                        <SelectItem value="complimentary">Complimentary</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Plan</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subscriptions match.</TableCell></TableRow>}
                    {filtered.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.subscription_plans?.name || s.plan_type}</TableCell>
                        <TableCell>{formatMoney(s.amount_usd)}</TableCell>
                        <TableCell className="capitalize">{(s.payment_method || "—").replace("_", " ")}</TableCell>
                        <TableCell><Badge className="capitalize">{s.status}</Badge></TableCell>
                        <TableCell>{s.access_end ? new Date(s.access_end).toLocaleDateString() : "—"}</TableCell>
                        <TableCell className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => extend(s.id, 30)}><Plus className="w-3 h-3 mr-1" />30d</Button>
                          {s.status === "active" && <Button size="sm" variant="outline" onClick={() => suspend(s.id)}><Pause className="w-3 h-3" /></Button>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verify">
            <Card>
              <CardHeader><CardTitle>Bank transfers awaiting verification</CardTitle></CardHeader>
              <CardContent>
                {payments.filter((p) => p.payment_status === "awaiting_verification").length === 0 && (
                  <div className="text-center text-muted-foreground py-8">No payments awaiting verification.</div>
                )}
                {payments.filter((p) => p.payment_status === "awaiting_verification").map((p) => (
                  <div key={p.id} className="flex items-center justify-between border rounded-lg p-4 mb-2">
                    <div>
                      <div className="font-semibold">{formatMoney(p.amount_usd ?? p.amount)} · {p.payment_method}</div>
                      <div className="text-xs text-muted-foreground">Parent {p.parent_id.slice(0, 8)} · {new Date(p.created_at).toLocaleString()}</div>
                      {p.proof_of_payment_url && <a href={p.proof_of_payment_url} className="text-xs text-blue-600 underline" target="_blank" rel="noreferrer">View proof</a>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => verifyPayment(p.id, p.subscription_id, true)}><CheckCircle2 className="w-4 h-4 mr-1" />Approve</Button>
                      <Button size="sm" variant="destructive" onClick={() => verifyPayment(p.id, p.subscription_id, false)}><XCircle className="w-4 h-4 mr-1" />Reject</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle>Revenue last 6 months</CardTitle></CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyChart}>
                      <XAxis dataKey="label" /><YAxis /><Tooltip />
                      <Bar dataKey="total" fill="#0d9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>Payment method mix</CardTitle></CardHeader>
                <CardContent className="h-72">
                  {methodChart.length === 0 ? (
                    <div className="text-center text-muted-foreground pt-16">No paid transactions yet.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={methodChart} dataKey="value" nameKey="name" outerRadius={80} label>
                          {methodChart.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip /><Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="md:col-span-2">
                <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-sm">Export term revenue, outstanding payments, and payment-method analysis.</div>
                  <Button variant="outline" onClick={() => {
                    const csv = ["Date,Plan,Amount,Method,Status",
                      ...payments.map(p => `${p.created_at},${p.payment_method},${p.amount},${p.payment_method},${p.payment_status}`)].join("\n");
                    const blob = new Blob([csv], { type: "text/csv" });
                    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "payments.csv"; a.click();
                  }}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" /> Export CSV
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tint }: { icon: LucideIcon; label: string; value: React.ReactNode; tint: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-4">
          <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${tint} text-white flex items-center justify-center mb-2`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="font-bold text-xl">{value}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
