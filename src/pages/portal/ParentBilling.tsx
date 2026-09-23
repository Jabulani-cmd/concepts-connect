import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Check, Clock, AlertTriangle, Receipt, RefreshCw, Sparkles, ShieldCheck, CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { formatMoney } from "@/lib/currency";
import { format } from "date-fns";
import CurrencyConverter from "@/components/finance/CurrencyConverter";
import type { Tables } from "@/integrations/supabase/types";
import { planFeatures } from "@/lib/plans";

type SubscriptionPayment = Tables<"payments"> & {
  subscriptions?: (Partial<Tables<"subscriptions">> & { subscription_plans?: { name: string } | null }) | null;
};

export default function ParentBilling() {
  const nav = useNavigate();
  const { user } = useAuth();
  const sub = useSubscription();
  const [plans, setPlans] = useState<Tables<"subscription_plans">[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: pay }] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("is_active", true).order("amount_usd"),
        user
          ? supabase
              .from("payments")
              .select("*, subscriptions(plan_type, access_start, access_end, subscription_plans(name))")
              .eq("parent_id", user.id)
              .order("created_at", { ascending: false })
              .limit(10)
          : Promise.resolve({ data: [] as SubscriptionPayment[] }),
      ]);
      setPlans(p || []);
      setPayments(pay || []);
    })();
  }, [user]);

  const statusBadge = () => {
    if (sub.loading) return <Badge variant="outline">Loading…</Badge>;
    if (sub.status === "active") return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300"><Check className="w-3 h-3 mr-1" /> Active</Badge>;
    if (sub.status === "pending") return <Badge className="bg-amber-100 text-amber-700 border-amber-300"><Clock className="w-3 h-3 mr-1" /> Pending Verification</Badge>;
    if (sub.status === "expired") return <Badge className="bg-red-100 text-red-700 border-red-300"><AlertTriangle className="w-3 h-3 mr-1" /> Expired</Badge>;
    if (sub.status === "complimentary") return <Badge className="bg-sky-100 text-sky-700 border-sky-300"><Sparkles className="w-3 h-3 mr-1" /> Complimentary</Badge>;
    return <Badge variant="outline">No active plan</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/30 dark:from-slate-950 dark:via-teal-950/20 dark:to-blue-950/20">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => nav("/portal/parent-teacher")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to dashboard
        </Button>

        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold">Billing & Subscription</h1>
          <p className="text-muted-foreground">Manage your portal access plan, change plans, and review past payments.</p>
        </div>

        <div className="mb-6"><CurrencyConverter /></div>

        {/* Current subscription */}
        <Card className="mb-6 border-2 border-teal-500/30">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-5 h-5 text-teal-600" />
                  <h2 className="font-semibold text-lg">Current Subscription</h2>
                  {statusBadge()}
                </div>
                <p className="text-sm text-muted-foreground">
                  {sub.plan ? `${sub.plan}${sub.planType ? ` · ${sub.planType}` : ""}` : "You don't have an active plan yet."}
                </p>
                {sub.expiresAt && (
                  <p className="text-sm mt-1">
                    {sub.status === "active" ? "Renews / expires on " : "Expired on "}
                    <strong>{format(sub.expiresAt, "dd MMM yyyy")}</strong>
                    {sub.status === "active" && sub.daysRemaining > 0 && (
                      <span className="text-muted-foreground"> · {sub.daysRemaining} day{sub.daysRemaining === 1 ? "" : "s"} left</span>
                    )}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => sub.refresh()} variant="outline" size="sm">
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
                <Button asChild className="bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90">
                  <Link to="/portal/parent/subscribe">
                    <Sparkles className="w-4 h-4 mr-2" />
                    {sub.status === "active" ? "Change Plan" : sub.status === "expired" ? "Renew Now" : "Subscribe"}
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <h2 className="font-display text-2xl font-bold mb-3">Available Plans</h2>
        <div className="grid md:grid-cols-2 gap-5 mb-8">
          {plans.map((p) => {
            const current = sub.isActive && sub.plan === p.name;
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={`relative overflow-hidden h-full ${p.is_recommended ? "border-teal-500 border-2 shadow-xl" : ""}`}>
                  {p.is_recommended && (
                    <div className="absolute top-0 right-0 bg-gradient-to-r from-teal-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                      <Crown className="w-3 h-3" /> BEST VALUE
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold font-display">{p.name}</h3>
                      {current && <Badge className="bg-emerald-100 text-emerald-700">Current</Badge>}
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-3xl font-bold">{formatMoney(p.amount_usd, { decimals: false })}</span>
                      <span className="text-muted-foreground text-sm">/ {p.plan_type === "monthly" ? "month" : "term"}</span>
                    </div>
                    {p.description && <p className="text-sm mt-3">{p.description}</p>}
                    <ul className="mt-4 space-y-1.5">
                      {planFeatures(p).slice(0, 6).map((f) => (
                        <li key={f} className="flex gap-2 text-sm">
                          <Check className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      variant={current ? "outline" : "default"}
                      className={`w-full mt-5 ${!current && p.is_recommended ? "bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90" : ""}`}
                    >
                      <Link to="/portal/parent/subscribe">
                        {current ? "Manage / Renew" : "Choose Plan"}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Payment history */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-2xl font-bold">Recent Payments</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/portal/parent/payments"><Receipt className="w-4 h-4 mr-2" />View all</Link>
          </Button>
        </div>
        <Card>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                No payments yet. Subscribe to a plan to get started.
              </div>
            ) : (
              <div className="divide-y">
                {payments.map((p) => (
                  <div key={p.id} className="p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-950/40 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-teal-600" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {p.subscriptions?.subscription_plans?.name || "Subscription"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(p.created_at), "dd MMM yyyy")} · {p.payment_method?.replace("_", " ")} · {p.receipt_number || p.transaction_id}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="font-semibold">{formatMoney(p.amount)}</div>
                        <div className="text-xs">
                          <Badge variant={p.payment_status === "paid" ? "default" : "outline"} className={
                            p.payment_status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                            p.payment_status === "awaiting_verification" ? "bg-amber-100 text-amber-700 border-amber-300" :
                            ""
                          }>
                            {p.payment_status?.replace("_", " ")}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
