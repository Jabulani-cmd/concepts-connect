import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  CreditCard, Building2, Lock, Loader2, Check, X, AlertCircle, ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { paymentMethodLabel, type PaymentMethod } from "@/lib/finance/paymentMethods";
import { useToast } from "@/hooks/use-toast";
import { formatMoney } from "@/lib/currency";
import { generateAndStoreReceipt } from "@/lib/finance/receiptStorage";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import type { Tables } from "@/integrations/supabase/types";

type Outcome = "auto" | "approve" | "insufficient" | "declined";
type Step = "amount" | "method" | "card" | "gateway" | "qr" | "success" | "failed";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: Pick<Tables<"invoices">, "id" | "invoice_number">;
  student: { id: string; full_name: string; admission_number?: string };
  outstanding: number;
  onPaid?: () => void;
}


export default function PayInvoiceDialog({ open, onOpenChange, invoice, student, outstanding, onPaid }: Props) {
  const { toast } = useToast();
  const { rate, usdToZig } = useExchangeRate();
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [forceOutcome, setForceOutcome] = useState<Outcome>("approve");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string>("");
  const [failReason, setFailReason] = useState<string>("");

  useEffect(() => {
    if (open) {
      setStep("amount");
      setAmount(outstanding.toFixed(2));
      setForceOutcome("approve");
      setError(null);
      setCardNumber(""); setCardName(""); setCardExpiry(""); setCardCvv("");
    }
  }, [open, outstanding]);

  const payAmount = Math.max(0, Math.min(Number(amount) || 0, outstanding));

  function goToMethod() {
    if (!payAmount) { setError("Enter an amount greater than zero."); return; }
    if (payAmount > outstanding + 0.001) { setError("Amount exceeds outstanding balance."); return; }
    setError(null);
    setStep("method");
  }

  function pickMethod(m: PaymentMethod) {
    setMethod(m); setError(null);
    if (m === "card") setStep("card");
    else if (m === "eft") setStep("gateway");
    else setStep("qr");
  }

  async function simulate(useCardCheck = false) {
    setError(null);
    if (useCardCheck) {
      const clean = cardNumber.replace(/\s/g, "");
      if (!/^\d{12,19}$/.test(clean)) return setError("Enter a valid 12–19 digit card number.");
      if (!cardName.trim()) return setError("Enter the cardholder name.");
      if (!/^\d{2}\/\d{2}$/.test(cardExpiry)) return setError("Expiry must be MM/YY.");
      if (!/^\d{3,4}$/.test(cardCvv)) return setError("CVV must be 3 or 4 digits.");
    }
    setProcessing(true);
    await new Promise((r) => setTimeout(r, 2000));

    let approved = forceOutcome === "approve";
    if (forceOutcome === "auto" && useCardCheck) {
      const clean = cardNumber.replace(/\s/g, "");
      approved = parseInt(clean[clean.length - 1], 10) % 2 === 0;
    }

    if (!approved) {
      setFailReason(
        forceOutcome === "insufficient"
          ? "Payment Declined: Insufficient Funds."
          : "Transaction Failed: Card Declined by your bank.",
      );
      setProcessing(false);
      setStep("failed");
      return;
    }

    try {
      const receiptNumber = "MTR-" + Math.floor(100000 + Math.random() * 900000);
      const txId = "SPS-" + Date.now().toString(36).toUpperCase();
      const payDate = new Date().toISOString().slice(0, 10);

      const { data: inserted, error: payErr } = await supabase.from("payments").insert({
        receipt_number: receiptNumber,
        invoice_id: invoice.id,
        student_id: student.id,
        amount: payAmount,
        currency: "USD",
        amount_usd: payAmount,
        amount_zig: usdToZig(payAmount),
        payment_method: method,
        payment_status: "paid",
        reference_number: txId,
        payment_date: payDate,
        notes: `Paynow Zimbabwe (${paymentMethodLabel(method)}), parent portal`,
      }).select("id").single();
      if (payErr) throw payErr;

      // Invoice paid_usd/status is updated automatically by DB trigger.

      // Generate the branded receipt PDF, upload to storage, and mark the
      // payment as auto-verified (instant gateway confirms success itself).
      const { data: { user } } = await supabase.auth.getUser();
      generateAndStoreReceipt({
        paymentId: inserted!.id,
        receiptNumber,
        paymentDate: payDate,
        paymentMethod: method,
        referenceNumber: txId,
        amount: payAmount,
        student: {
          fullName: student.full_name,
          admissionNumber: student.admission_number || "-",
        },
        invoiceNumber: invoice.invoice_number,
        autoVerify: true,
        verifiedBy: user?.id || null,
      }).catch((e) => console.error("[PayInvoiceDialog] receipt generation failed", e));

      setReceipt(receiptNumber);
      setStep("success");
      toast({ title: "Payment successful", description: `Receipt ${receiptNumber}` });
      onPaid?.();
    } catch (e) {
      // Real backend/schema error - do NOT show as a gateway decline.
      console.error("[PayInvoiceDialog] Failed to record payment:", e);
      setFailReason("Something went wrong processing your payment. Please try again later.");
      setStep("failed");
      toast({
        title: "Payment could not be processed",
        description: "A system error occurred. Your card was not charged.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  }

  const DemoBadge = () => (
    <Badge variant="outline" className="border-amber-400/60 text-amber-700 bg-amber-50">
      Demo Mode. No real money processed
    </Badge>
  );

  const OutcomeSelect = () => (
    <div className="rounded-md border border-dashed border-amber-400/50 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-xs font-semibold">Simulate outcome</Label>
        <DemoBadge />
      </div>
      <select
        value={forceOutcome}
        onChange={(e) => setForceOutcome(e.target.value as Outcome)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        <option value="approve">Success</option>
        <option value="insufficient">Insufficient Funds</option>
        <option value="declined">Card Declined</option>
      </select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay Invoice {invoice?.invoice_number}</DialogTitle>
          <DialogDescription>
            {student.full_name} · Outstanding {formatMoney(outstanding)}
          </DialogDescription>
        </DialogHeader>

        {step === "amount" && (
          <div className="space-y-4">
            <div>
              <Label>Amount to pay (US$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max={outstanding}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 font-mono text-lg"
              />
              <p className="text-xs text-muted-foreground mt-1">
                ZiG {usdToZig(payAmount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at US$ 1 = ZiG {rate.toFixed(2)}. Pay the full balance or enter a lower amount.
              </p>
            </div>
            {error && (
              <div className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {error}
              </div>
            )}
            <Button className="w-full" size="lg" onClick={goToMethod}>Continue</Button>
          </div>
        )}

        {step === "method" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm">Paying <strong>{formatMoney(payAmount)}</strong></div>
              <DemoBadge />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "card", label: "Card", icon: CreditCard, note: "Visa / Mastercard" },
                { id: "eft", label: "Internet Banking", icon: Building2, note: "ZIPIT: CBZ, Stanbic, Steward, ZB…" },
                { id: "ecocash", label: "EcoCash", icon: CreditCard, note: "Mobile money" },
                { id: "onemoney", label: "OneMoney", icon: CreditCard, note: "Mobile money" },
              ] satisfies { id: PaymentMethod; label: string; icon: typeof CreditCard; note: string }[]).map((m) => (
                <button key={m.id} onClick={() => pickMethod(m.id)}
                  className="p-4 rounded-lg border-2 border-border hover:border-teal-500 hover:bg-teal-50/40 text-left transition">
                  <m.icon className="w-6 h-6 mb-1 text-teal-600" />
                  <div className="font-semibold text-sm">{m.label}</div>
                  <div className="text-xs text-muted-foreground">{m.note}</div>
                </button>
              ))}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> Processed by Paynow Zimbabwe (demo).
            </div>
          </div>
        )}

        {step === "card" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-teal-600" />
              <h3 className="font-semibold">Paynow Zimbabwe: Card</h3>
            </div>
            {!processing ? (
              <>
                <div>
                  <Label>Card number</Label>
                  <Input value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4111 1111 1111 1111" className="mt-1 font-mono" />
                </div>
                <div>
                  <Label>Cardholder</Label>
                  <Input value={cardName} onChange={(e) => setCardName(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Expiry</Label>
                    <Input value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM/YY" className="mt-1 font-mono" />
                  </div>
                  <div>
                    <Label>CVV</Label>
                    <Input value={cardCvv} onChange={(e) => setCardCvv(e.target.value)} type="password" placeholder="123" className="mt-1 font-mono" />
                  </div>
                </div>
                <OutcomeSelect />
                {error && <div className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
                <Button className="w-full" size="lg" onClick={() => simulate(true)}>
                  <Lock className="w-4 h-4 mr-2" /> Pay {formatMoney(payAmount)}
                </Button>
              </>
            ) : (
              <div className="text-center py-6">
                <Loader2 className="w-10 h-10 animate-spin mx-auto text-teal-600" />
                <div className="mt-3 text-sm">Contacting your bank…</div>
                <Progress value={70} className="mt-3" />
              </div>
            )}
          </div>
        )}

        {step === "gateway" && (
          <div className="text-center space-y-3">
            <Building2 className="w-12 h-12 mx-auto text-teal-600" />
            <h3 className="font-semibold">Paynow Zimbabwe: Internet Banking (ZIPIT)</h3>
            <p className="text-sm text-muted-foreground">
              Authorise a {formatMoney(payAmount)} payment with your bank.
            </p>
            {!processing && <div className="text-left"><OutcomeSelect /></div>}
            {processing ? (
              <div><Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" /><div className="text-sm mt-2">Redirecting…</div></div>
            ) : (
              <Button size="lg" className="w-full" onClick={() => simulate(false)}>Continue to Bank</Button>
            )}
          </div>
        )}

        {step === "qr" && (
          <div className="text-center space-y-3">
            <h3 className="font-semibold">Paynow Zimbabwe: {method === "ecocash" ? "EcoCash" : "OneMoney"}</h3>
            <p className="text-sm text-muted-foreground">
              Scan to pay {formatMoney(payAmount)}
            </p>
            <div className="mx-auto my-2 h-40 w-40 rounded-lg border-4 border-foreground p-2 bg-white">
              <div className="h-full w-full" style={{ backgroundImage: "repeating-conic-gradient(#0f172a 0% 25%, #ffffff 0% 50%)", backgroundSize: "14px 14px" }} />
            </div>
            {!processing && <div className="text-left"><OutcomeSelect /></div>}
            {processing ? (
              <div><Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" /><div className="text-sm mt-2">Waiting for confirmation…</div></div>
            ) : (
              <Button size="lg" className="w-full" onClick={() => simulate(false)}>I have scanned & paid</Button>
            )}
          </div>
        )}

        {step === "success" && (
          <div className="text-center py-4 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center">
              <Check className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold">Payment Successful</h3>
            <div className="bg-muted/40 rounded-lg p-3 text-sm text-left space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Receipt</span><strong>{receipt}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><strong>{formatMoney(payAmount)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Method</span><strong>{paymentMethodLabel(method)}</strong></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Invoice</span><strong>{invoice.invoice_number}</strong></div>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}

        {step === "failed" && (
          <div className="text-center py-4 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-600 flex items-center justify-center">
              <X className="w-8 h-8 text-white" strokeWidth={3} />
            </div>
            <h3 className="text-xl font-bold">Payment Declined</h3>
            <p className="text-sm text-muted-foreground">{failReason}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setStep("method")}>Change Method</Button>
              <Button onClick={() => setStep(method === "card" ? "card" : method === "eft" ? "gateway" : "qr")}>Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
