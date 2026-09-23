import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Sparkles, Building2, CreditCard, ArrowLeft,
  Loader2, ShieldCheck, AlertCircle, Upload, Receipt, Crown, Lock, X,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/finance/paymentMethods";
import type { Enums } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { downloadSubscriptionReceipt } from "@/lib/receiptPdf";
import { formatMoney } from "@/lib/currency";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import CurrencyConverter from "@/components/finance/CurrencyConverter";

type Step = "plans" | "method" | "card" | "eft" | "gateway" | "qr" | "success" | "failed";


type Outcome = "auto" | "approve" | "insufficient" | "declined";

// Mock Paynow Zimbabwe test cards — a card number ending in an odd digit fails.
function isTestCardApproved(number: string) {
  const digits = number.replace(/\s/g, "");
  if (digits.length < 12) return false;
  const last = parseInt(digits[digits.length - 1], 10);
  return last % 2 === 0;
}

export default function ParentSubscribe() {
  const nav = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const sub = useSubscription();
  const { usdToZig } = useExchangeRate();

  const [plans, setPlans] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [bank, setBank] = useState<any>(null);

  const [step, setStep] = useState<Step>("plans");
  const [plan, setPlan] = useState<any | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");

  // Card form
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [forceOutcome, setForceOutcome] = useState<Outcome>("auto");

  const [proof, setProof] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [failureReason, setFailureReason] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [{ data: p }, { data: b }] = await Promise.all([
        supabase.from("subscription_plans").select("*").eq("is_active", true).order("amount_usd"),
        supabase.from("school_bank_details").select("*").eq("is_active", true).maybeSingle(),
      ]);
      setPlans(p || []);
      setBank(b);

      if (user) {
        // No FK relationship exists between parent_students/parent_student_links and students,
        // so PostgREST embeds return null. Fetch student IDs first, then load the student rows.
        const [{ data: linkRows }, { data: legacyRows }] = await Promise.all([
          supabase.from("parent_student_links").select("student_id").eq("parent_id", user.id),
          supabase.from("parent_students").select("student_id").eq("parent_id", user.id),
        ]);
        const ids = Array.from(new Set([
          ...(linkRows || []).map((r: any) => r.student_id),
          ...(legacyRows || []).map((r: any) => r.student_id),
        ].filter(Boolean)));

        if (!ids.length) {
          setChildren([]);
          setSelectedChild(null);
        } else {
          const { data: kids } = await supabase
            .from("students")
            .select("id, full_name, form, stream, admission_number")
            .in("id", ids);
          const list = kids || [];
          setChildren(list);
          setSelectedChild(list[0]?.id || null);
        }
      }
    })();
  }, [user]);

  const childName = useMemo(() => {
    const found = children.find((c) => c.id === selectedChild);
    return found?.full_name || "your child";
  }, [children, selectedChild]);

  function pickPlan(p: any) {
    if (!selectedChild) {
      toast({ title: "Link a student first", description: "Please link a student to your account before choosing a plan.", variant: "destructive" });
      return;
    }
    setPlan(p); setStep("method");
  }
  function pickMethod(m: PaymentMethod) {
    setMethod(m); setError(null);
    if (m === "card") setStep("card");
    else if (m === "eft") setStep("gateway");
    else if (m === "ecocash" || m === "onemoney") setStep("qr");
    else setStep("eft");
  }

  function outcomeReason(o: Outcome): string {
    if (o === "insufficient") return "Payment Declined — Insufficient Funds. Please use a different card or method.";
    if (o === "declined") return "Transaction Failed — Card Declined by your bank. Please try again or use another method.";
    return "Your bank declined the transaction. Please try a different card or use Internet Banking (ZIPIT).";
  }

  async function processCard() {
    const cleanNum = cardNumber.replace(/\s/g, "");
    if (!/^\d{12,19}$/.test(cleanNum)) return setError("Enter a valid 12–19 digit card number.");
    if (!cardName.trim()) return setError("Enter the cardholder name.");
    if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return setError("Expiry must be MM/YY.");
    if (!/^\d{3,4}$/.test(cardCvv)) return setError("CVV must be 3 or 4 digits.");
    setError(null);
    setProcessing(true);

    await new Promise((r) => setTimeout(r, 2200));

    const approved =
      forceOutcome === "approve" ? true
      : forceOutcome === "insufficient" || forceOutcome === "declined" ? false
      : isTestCardApproved(cleanNum);

    if (approved) {
      await finalize(true);
    } else {
      await recordFailedAttempt();
      setFailureReason(outcomeReason(forceOutcome));
      setProcessing(false);
      setStep("failed");
    }
  }

  async function processEftGateway() {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2500));
    const approved = forceOutcome === "approve" || forceOutcome === "auto";
    if (approved) await finalize(true);
    else {
      await recordFailedAttempt();
      setFailureReason(outcomeReason(forceOutcome));
      setProcessing(false);
      setStep("failed");
    }
  }

  async function processQrGateway() {
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2500));
    const approved = forceOutcome === "approve" || forceOutcome === "auto";
    if (approved) await finalize(true);
    else {
      await recordFailedAttempt();
      setFailureReason(outcomeReason(forceOutcome));
      setProcessing(false);
      setStep("failed");
    }
  }

  async function recordFailedAttempt() {
    try {
      const txId = "SPS-" + Date.now().toString(36).toUpperCase();
      await supabase.from("payments").insert({
        parent_id: user.id,
        amount: plan.amount_usd,
        amount_usd: plan.amount_usd,
        amount_zig: usdToZig(plan.amount_usd),
        currency: "USD",
        payment_method: method,
        transaction_id: txId,
        receipt_number: null,
        payment_status: "failed",
        rejection_reason: forceOutcome === "insufficient" ? "Insufficient funds" : "Declined by bank",
      });
    } catch (e) {
      console.error("Could not record failed payment attempt", e);
    }
  }

  async function submitBankTransfer() {
    if (!proof) { setError("Please upload your proof of payment first."); return; }
    setError(null); setProcessing(true);
    await createPayment("awaiting_verification", "pending");
    setProcessing(false);
    toast({ title: "Submitted for verification", description: "An administrator will verify your transfer shortly." });
    nav("/portal/parent/payments");
  }

  async function createPayment(paymentStatus: Enums<"payment_status">, subStatus: Enums<"subscription_status">) {
    const accessStart = new Date();
    const accessEnd = new Date(accessStart.getTime() + plan.duration_days * 86_400_000);
    const txId = "SPS-" + Date.now().toString(36).toUpperCase();
    const receiptNumber = "MTR-" + Math.floor(100000 + Math.random() * 900000);

    const { data: subRow, error: subErr } = await supabase.from("subscriptions").insert({
      parent_id: user.id,
      student_id: selectedChild,
      plan_id: plan.id,
      plan_type: plan.plan_type,
      amount_usd: plan.amount_usd,    // USD amount
      amount_zwg: usdToZig(plan.amount_usd),
      currency_paid: "USD",
      payment_method: method,
      transaction_id: txId,
      status: subStatus,
      access_start: subStatus === "active" ? accessStart.toISOString() : null,
      access_end: subStatus === "active" ? accessEnd.toISOString() : null,
      term: "Term " + (Math.floor(new Date().getMonth() / 4) + 1),
      academic_year: new Date().getFullYear().toString(),
    }).select().single();
    if (subErr) throw subErr;

    await supabase.from("payments").insert({
      subscription_id: subRow.id,
      parent_id: user.id,
      amount: plan.amount_usd,
      amount_usd: plan.amount_usd,
      amount_zig: usdToZig(plan.amount_usd),
      currency: "USD",
      payment_method: method,
      transaction_id: txId,
      receipt_number: receiptNumber,
      payment_status: paymentStatus,
    });

    if (subStatus === "active") {
      await supabase.from("access_grants").insert({
        parent_id: user.id,
        student_id: selectedChild,
        grant_type: "paid",
        access_start: accessStart.toISOString(),
        access_end: accessEnd.toISOString(),
        subscription_id: subRow.id,
        is_active: true,
      });
    }
    return { subRow, receiptNumber, accessStart, accessEnd, txId };
  }

  async function finalize(success: boolean) {
    if (!success) { setProcessing(false); return; }
    try {
      const result = await createPayment("paid", "active");
      setCompleted({ ...result, plan, method, childName });
      setStep("success");
      sub.refresh();
      toast({ title: "Payment successful 🎉", description: "Portal access activated." });
    } catch (e: any) {
      setError(e.message || "Failed to record payment.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-blue-50/30 dark:from-slate-950 dark:via-teal-950/20 dark:to-blue-950/20">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Button variant="ghost" onClick={() => (step === "plans" ? nav(-1) : setStep("plans"))} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-8">
          <Badge variant="outline" className="mb-3 border-teal-500/40 text-teal-700 dark:text-teal-300">
            <Sparkles className="w-3 h-3 mr-1" /> Parent Portal Access
          </Badge>
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            {children.length === 0 ? (
              <>Unlock access for <span className="text-teal-600">your child</span></>
            ) : (
              <>Unlock access for <span className="text-teal-600">{childName}</span></>
            )}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Choose a plan to give your family full access to the timetable, results, lesson plans, attendance, and direct teacher messaging.
          </p>
        </div>

        {step === "plans" && <div className="mx-auto mb-6 max-w-4xl"><CurrencyConverter /></div>}

        {children.length === 0 && step === "plans" && (
          <Card className="max-w-xl mx-auto mb-8 p-6 text-center border-amber-200 bg-amber-50/40 dark:bg-amber-950/20">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-600 mb-3" />
            <h3 className="text-lg font-semibold mb-2">Link a student first</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Before you can subscribe, link a student to your parent account using their admission number.
            </p>
            <Button onClick={() => nav("/portal/parent")}>Go to Parent Dashboard</Button>
          </Card>
        )}

        {children.length > 1 && step === "plans" && (
          <div className="flex flex-wrap gap-2 justify-center mb-6">
            {children.map((c) => (
              <Button key={c.id} size="sm" variant={selectedChild === c.id ? "default" : "outline"} onClick={() => setSelectedChild(c.id)}>
                {c.full_name}
              </Button>
            ))}
          </div>
        )}

        <AnimatePresence mode="wait">
          {step === "plans" && <PlansView plans={plans} onPick={pickPlan} />}
          {step === "method" && <MethodView plan={plan} onPick={pickMethod} />}
          {step === "card" && (
            <CardView
              plan={plan}
              cardNumber={cardNumber} setCardNumber={setCardNumber}
              cardName={cardName} setCardName={setCardName}
              cardExpiry={cardExpiry} setCardExpiry={setCardExpiry}
              cardCvv={cardCvv} setCardCvv={setCardCvv}
              forceOutcome={forceOutcome} setForceOutcome={setForceOutcome}
              onPay={processCard} processing={processing} error={error}
            />
          )}
          {step === "eft" && (
            <BankView bank={bank} proof={proof} setProof={setProof} onSubmit={submitBankTransfer} processing={processing} error={error} plan={plan} />
          )}
          {step === "gateway" && (
            <GatewayView plan={plan} processing={processing} onStart={processEftGateway} forceOutcome={forceOutcome} setForceOutcome={setForceOutcome} />
          )}
          {step === "qr" && (
            <QrView plan={plan} method={method} processing={processing} onConfirm={processQrGateway} forceOutcome={forceOutcome} setForceOutcome={setForceOutcome} />
          )}
          {step === "failed" && (
            <FailedView reason={failureReason} onRetry={() => setStep(method === "card" ? "card" : method === "ecocash" || method === "onemoney" ? "qr" : "gateway")} onChangeMethod={() => setStep("method")} />
          )}
          {step === "success" && completed && (
            <SuccessView
              data={completed}
              onDownload={() => downloadSubscriptionReceipt({
                receiptNumber: completed.receiptNumber,
                parentName: user?.email || "Parent",
                studentName: completed.childName,
                amount: Number(completed.plan.amount_usd),
                currency: "USD",
                method: paymentMethodLabel(completed.method),
                transactionId: completed.txId,
                plan: completed.plan.name,
                accessStart: completed.accessStart,
                accessEnd: completed.accessEnd,
                date: new Date(),
              })}
              onPortal={() => nav("/portal/parent")}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ────────── Step views ──────────
function PlansView({ plans, onPick }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
      {plans.map((p) => (
        <Card key={p.id} className={`relative overflow-hidden ${p.is_recommended ? "border-teal-500 border-2 shadow-xl" : ""}`}>
          {p.is_recommended && (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-teal-500 to-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center gap-1">
              <Crown className="w-3 h-3" /> BEST VALUE
            </div>
          )}
          <CardContent className="p-7">
            <h3 className="text-2xl font-bold font-display">{p.name}</h3>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold">{formatMoney(p.amount_usd, { decimals: false })}</span>
              <span className="text-muted-foreground">/ {p.plan_type === "monthly" ? "month" : "term"}</span>
            </div>
            <p className="text-sm mt-3">{p.description}</p>
            <ul className="mt-5 space-y-2">
              {(p.features || []).slice(0, 10).map((f: string) => (
                <li key={f} className="flex gap-2 text-sm">
                  <Check className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" /><span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              className={`w-full mt-6 ${p.is_recommended ? "bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90" : ""}`}
              size="lg" onClick={() => onPick(p)}
            >Choose {p.name}</Button>
          </CardContent>
        </Card>
      ))}
    </motion.div>
  );
}

function DemoBadge() {
  return (
    <Badge variant="outline" className="border-amber-400/60 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30">
      Demo Mode — no real money processed
    </Badge>
  );
}

function OutcomeSelect({ value, onChange, includeAuto = true }: { value: Outcome; onChange: (v: Outcome) => void; includeAuto?: boolean }) {
  const opts: { v: Outcome; label: string }[] = [
    ...(includeAuto ? [{ v: "auto" as Outcome, label: "Auto (based on card)" }] : []),
    { v: "approve", label: "Success" },
    { v: "insufficient", label: "Insufficient Funds" },
    { v: "declined", label: "Card Declined" },
  ];
  return (
    <div className="rounded-md border border-dashed border-amber-400/50 bg-amber-50/40 dark:bg-amber-950/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-semibold">Simulate outcome</Label>
        <DemoBadge />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Outcome)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {opts.map((o) => (
          <option key={o.v} value={o.v}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function MethodView({ plan, onPick }: any) {
  const methods = [
    { id: "card", label: "Card Payment", icon: CreditCard, note: "Visa / Mastercard — Paynow Zimbabwe" },
    { id: "eft", label: "Internet Banking", icon: Building2, note: "ZIPIT — CBZ, Stanbic, Steward, ZB Bank" },
    { id: "ecocash", label: "EcoCash", icon: CreditCard, note: "Pay from your EcoCash wallet" },
    { id: "onemoney", label: "OneMoney", icon: CreditCard, note: "Pay from your OneMoney wallet" },
    { id: "bank_transfer", label: "Bank Transfer", icon: Building2, note: "RTGS transfer — upload proof of payment" },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-3xl mx-auto">
      <Card className="p-6 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-sm text-muted-foreground">Selected plan</div>
            <div className="font-semibold text-lg">{plan.name}</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatMoney(plan.amount_usd)}</div>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-lg">Choose a payment method</h3>
        <DemoBadge />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {methods.map((m) => (
          <button key={m.id} onClick={() => onPick(m.id)}
            className="p-5 rounded-xl border-2 border-border hover:border-teal-500 hover:bg-teal-50/40 dark:hover:bg-teal-950/20 transition text-left group">
            <m.icon className="w-7 h-7 mb-2 text-teal-600 group-hover:scale-110 transition" />
            <div className="font-semibold">{m.label}</div>
            <div className="text-xs text-muted-foreground">{m.note}</div>
          </button>
        ))}
      </div>
      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-4">
        <ShieldCheck className="w-4 h-4" /> Processed by Paynow Zimbabwe. Demo environment — no real money is moved.
      </div>
    </motion.div>
  );
}

function CardView({ plan, cardNumber, setCardNumber, cardName, setCardName, cardExpiry, setCardExpiry, cardCvv, setCardCvv, forceOutcome, setForceOutcome, onPay, processing, error }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto">
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-5 h-5 text-teal-600" />
          <h3 className="font-semibold text-lg">Paynow Zimbabwe — Card Payment</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">3D Secure protected · PCI-DSS Level 1</p>

        {!processing ? (
          <div className="space-y-3">
            <div>
              <Label>Card number</Label>
              <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4111 1111 1111 1111" className="mt-1 font-mono" />
            </div>
            <div>
              <Label>Cardholder name</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="As printed on card" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Expiry</Label>
                <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" className="mt-1 font-mono" />
              </div>
              <div>
                <Label>CVV</Label>
                <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} placeholder="123" className="mt-1 font-mono" type="password" />
              </div>
            </div>

            <OutcomeSelect value={forceOutcome} onChange={setForceOutcome} />


            {error && (
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </div>
            )}
            <div className="text-sm bg-muted/40 rounded-lg p-3">
              You will be charged <strong>{formatMoney(plan.amount_usd)}</strong>.
            </div>
            <Button className="w-full" size="lg" onClick={onPay}>
              <Lock className="w-4 h-4 mr-2" /> Pay {formatMoney(plan.amount_usd)}
            </Button>
          </div>
        ) : (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-600" />
            <div className="font-medium mt-4">Contacting your bank…</div>
            <div className="text-sm text-muted-foreground mt-1">Authenticating 3D Secure</div>
            <Progress value={70} className="mt-4" />
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function GatewayView({ plan, processing, onStart, forceOutcome, setForceOutcome }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto">
      <Card className="p-6 text-center">
        <Building2 className="w-12 h-12 mx-auto mb-3 text-teal-600" />
        <h3 className="font-semibold text-lg">Paynow Zimbabwe — Internet Banking (ZIPIT)</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-5">
          You will be redirected to your bank to authorise a {formatMoney(plan.amount_usd)} payment.
        </p>

        {!processing && (
          <div className="text-left mb-4">
            <OutcomeSelect value={forceOutcome} onChange={setForceOutcome} includeAuto={false} />
          </div>
        )}

        {processing ? (
          <div className="py-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            <div className="text-sm mt-2">Redirecting to your bank…</div>
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={onStart}>Continue to Bank</Button>
        )}
      </Card>
    </motion.div>
  );
}

function QrView({ plan, method, processing, onConfirm, forceOutcome, setForceOutcome }: any) {
  const brand = method === "ecocash" ? "EcoCash" : "OneMoney";
  const brandColor = method === "ecocash" ? "from-sky-500 to-blue-600" : "from-emerald-500 to-teal-600";
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-md mx-auto">
      <Card className="p-6 text-center">
        <div className={`inline-block bg-gradient-to-br ${brandColor} text-white text-xs font-bold px-3 py-1 rounded-full mb-3`}>
          {brand}
        </div>
        <h3 className="font-semibold text-lg">Paynow Zimbabwe — {brand}</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Open your {brand} app and scan the QR code to pay {formatMoney(plan.amount_usd)}.
        </p>

        {/* Simulated QR code */}
        <div className="mx-auto my-4 h-48 w-48 rounded-lg border-4 border-foreground p-3 bg-white">
          <div
            className="h-full w-full"
            style={{
              backgroundImage:
                "repeating-conic-gradient(#0f172a 0% 25%, #ffffff 0% 50%)",
              backgroundSize: "16px 16px",
            }}
            aria-label={`${brand} QR code (demo)`}
          />
        </div>

        {!processing && (
          <div className="text-left mb-4">
            <OutcomeSelect value={forceOutcome} onChange={setForceOutcome} includeAuto={false} />
          </div>
        )}

        {processing ? (
          <div className="py-3">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            <div className="text-sm mt-2">Waiting for {brand} confirmation…</div>
          </div>
        ) : (
          <Button size="lg" className="w-full" onClick={onConfirm}>I have scanned & paid</Button>
        )}
      </Card>
    </motion.div>
  );
}

function BankView({ bank, proof, setProof, onSubmit, processing, error, plan }: any) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="max-w-xl mx-auto">
      <Card className="p-6">
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-teal-600" /> Bank Transfer (RTGS)
        </h3>
        {bank ? (
          <div className="bg-muted/40 rounded-lg p-4 space-y-1 text-sm">
            <div><span className="text-muted-foreground">Bank:</span> <strong>{bank.bank_name}</strong></div>
            <div><span className="text-muted-foreground">Account Name:</span> <strong>{bank.account_name}</strong></div>
            <div><span className="text-muted-foreground">Account #:</span> <strong>{bank.account_number}</strong></div>
            {bank.branch && <div><span className="text-muted-foreground">Branch code:</span> {bank.branch}</div>}
            <div><span className="text-muted-foreground">Reference:</span> <strong>PARENT-{plan.plan_type.toUpperCase()}</strong></div>
            <div className="pt-2 border-t mt-2"><span className="text-muted-foreground">Amount:</span> <strong>{formatMoney(plan.amount_usd)}</strong></div>
          </div>
        ) : (
          <div className="bg-muted/40 rounded-lg p-4 text-sm space-y-1">
            <div><span className="text-muted-foreground">Bank:</span> <strong>First National Bank (FNB)</strong></div>
            <div><span className="text-muted-foreground">Account Name:</span> <strong>MavingTech Demo School</strong></div>
            <div><span className="text-muted-foreground">Account #:</span> <strong>62861234567</strong></div>
            <div><span className="text-muted-foreground">Branch code:</span> 250655</div>
            <div><span className="text-muted-foreground">Reference:</span> <strong>PARENT-{plan.plan_type.toUpperCase()}</strong></div>
            <div className="pt-2 border-t mt-2"><span className="text-muted-foreground">Amount:</span> <strong>{formatMoney(plan.amount_usd)}</strong></div>
          </div>
        )}

        <div className="mt-5">
          <Label>Upload proof of payment</Label>
          <div className="mt-2 border-2 border-dashed rounded-lg p-6 text-center hover:border-teal-500 transition">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setProof(e.target.files?.[0] || null)} className="hidden" id="proof-upload" />
            <label htmlFor="proof-upload" className="cursor-pointer">
              <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
              <div className="text-sm">{proof ? proof.name : "Click to upload screenshot or PDF"}</div>
            </label>
          </div>
          {error && <div className="text-xs text-destructive flex items-center gap-1 mt-2"><AlertCircle className="w-3 h-3" /> {error}</div>}
        </div>

        <Button className="w-full mt-5" size="lg" onClick={onSubmit} disabled={processing}>
          {processing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Submit for Verification
        </Button>
      </Card>
    </motion.div>
  );
}

function FailedView({ reason, onRetry, onChangeMethod }: any) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center">
      <Card className="p-8">
        <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center mb-4">
          <X className="w-10 h-10 text-white" strokeWidth={3} />
        </div>
        <h2 className="text-2xl font-bold font-display mb-1">Payment Declined</h2>
        <p className="text-muted-foreground text-sm mb-5">{reason}</p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onChangeMethod}>Change Method</Button>
          <Button onClick={onRetry} className="bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90">Try Again</Button>
        </div>
      </Card>
    </motion.div>
  );
}

function SuccessView({ data, onDownload, onPortal }: any) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-md mx-auto text-center">
      <Card className="p-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1 }}
          className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-4">
          <Check className="w-10 h-10 text-white" strokeWidth={3} />
        </motion.div>
        <h2 className="text-2xl font-bold font-display mb-1">Payment Successful 🎉</h2>
        <p className="text-muted-foreground text-sm mb-5">Portal access activated for {data.childName}.</p>

        <div className="bg-muted/40 rounded-lg p-4 text-left text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Receipt</span> <strong>{data.receiptNumber}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Plan</span> <strong>{data.plan.name}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span> <strong>{formatMoney(data.plan.amount_usd)}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span> <strong>{paymentMethodLabel(data.method)}</strong></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Access until</span> <strong>{new Date(data.accessEnd).toLocaleDateString("en-ZA")}</strong></div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-5">
          <Button variant="outline" onClick={onDownload}><Receipt className="w-4 h-4 mr-2" /> Download Receipt</Button>
          <Button onClick={onPortal} className="bg-gradient-to-r from-teal-600 to-blue-700 hover:opacity-90">Go to Portal</Button>
        </div>
      </Card>
    </motion.div>
  );
}
