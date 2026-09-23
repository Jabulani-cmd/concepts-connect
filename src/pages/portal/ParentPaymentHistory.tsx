import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Receipt, ArrowLeft, Sparkles, Clock, CheckCircle2, XCircle, AlertCircle, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { downloadSubscriptionReceipt } from "@/lib/receiptPdf";
import { formatMoney } from "@/lib/currency";
import type { Tables } from "@/integrations/supabase/types";

const STATUS_STYLES: Record<string, { label: string; cls: string; icon: LucideIcon }> = {
  paid: { label: "Paid", cls: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-700", icon: Clock },
  awaiting_verification: { label: "Awaiting verification", cls: "bg-amber-100 text-amber-700", icon: Clock },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700", icon: XCircle },
  rejected: { label: "Rejected", cls: "bg-red-100 text-red-700", icon: XCircle },
  cancelled: { label: "Cancelled", cls: "bg-slate-100 text-slate-700", icon: XCircle },
  refunded: { label: "Refunded", cls: "bg-slate-100 text-slate-700", icon: AlertCircle },
};

type SubscriptionPayment = Tables<"payments"> & {
  subscriptions?: (Partial<Tables<"subscriptions">> & { subscription_plans?: { name: string } | null }) | null;
};

export default function ParentPaymentHistory() {
  const nav = useNavigate();
  const { user } = useAuth();
  const sub = useSubscription();
  const [rows, setRows] = useState<SubscriptionPayment[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("payments")
        .select("*, subscriptions(plan_type, term, academic_year, access_start, access_end, subscription_plans(name))")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: false });
      setRows(data || []);
    })();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => nav(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="font-display text-3xl font-bold">Payment History</h1>
            <p className="text-muted-foreground text-sm">Your past payments, receipts, and subscription status.</p>
          </div>
          <Button onClick={() => nav("/portal/parent/subscribe")} className="bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90">
            <Sparkles className="w-4 h-4 mr-2" /> {sub.status === "expired" ? "Renew Now" : "New Subscription"}
          </Button>
        </div>

        {sub.isActive && (
          <Card className="mb-6 border-teal-500/40 bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/20 dark:to-blue-950/20">
            <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Current plan</div>
                <div className="font-semibold text-lg">{sub.plan}</div>
                {sub.expiresAt && (
                  <div className="text-sm mt-1">
                    Expires {sub.expiresAt.toLocaleDateString()} — <strong>{sub.daysRemaining}</strong> days remaining
                  </div>
                )}
              </div>
              <Badge className="bg-emerald-100 text-emerald-700 capitalize">{sub.status}</Badge>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>All payments</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No payments yet.</TableCell></TableRow>
                )}
                {rows.map((p) => {
                  const s = STATUS_STYLES[p.payment_status] || STATUS_STYLES.pending;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{p.subscriptions?.subscription_plans?.name || p.subscriptions?.plan_type || "—"}</TableCell>
                      <TableCell>{formatMoney(p.amount_usd ?? p.amount)}</TableCell>
                      <TableCell className="capitalize">{p.payment_method.replace("_", " ")}</TableCell>
                      <TableCell><Badge className={s.cls}><s.icon className="w-3 h-3 mr-1" />{s.label}</Badge></TableCell>
                      <TableCell>
                        {p.payment_status === "paid" && p.receipt_number ? (
                          <Button
                            size="sm" variant="outline"
                            onClick={() =>
                              downloadSubscriptionReceipt({
                                receiptNumber: p.receipt_number,
                                parentName: user?.email || "Parent",
                                studentName: p.subscriptions?.subscription_plans?.name ? "Linked student" : "—",
                                amount: Number(p.amount),
                                currency: p.currency,
                                method: p.payment_method,
                                transactionId: p.transaction_id || "—",
                                plan: p.subscriptions?.subscription_plans?.name || p.subscriptions?.plan_type || "—",
                                accessStart: p.subscriptions?.access_start || p.created_at,
                                accessEnd: p.subscriptions?.access_end || p.created_at,
                                date: p.created_at,
                              })
                            }
                          >
                            <Receipt className="w-3 h-3 mr-1" /> Download
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
