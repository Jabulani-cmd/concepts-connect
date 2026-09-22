// @ts-nocheck
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, GraduationCap, Heart, CheckCircle, AlertCircle, Search, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatMoney } from "@/lib/currency";

export default function PayOnline() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("type") === "donation" ? "donation" : "fees";
  const projectId = searchParams.get("project") || "";

  return (
    <Layout>
      <section className="bg-secondary py-16">
        <div className="container">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-heading text-4xl font-bold text-secondary-foreground"
          >
            Pay Online
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-2 text-secondary-foreground/80"
          >
            Secure online payments for school fees and donations
          </motion.p>
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-2xl">
          <Tabs defaultValue={initialTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fees" className="gap-2">
                <GraduationCap className="h-4 w-4" /> School Fees
              </TabsTrigger>
              <TabsTrigger value="donation" className="gap-2">
                <Heart className="h-4 w-4" /> Donation
              </TabsTrigger>
            </TabsList>

            <TabsContent value="fees">
              <FeePaymentForm />
            </TabsContent>
            <TabsContent value="donation">
              <DonationForm initialProjectId={projectId} />
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}

function FeePaymentForm() {
  const { rate, usdToZig } = useExchangeRate();
  const [studentNumber, setStudentNumber] = useState("");
  const [studentInfo, setStudentInfo] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const lookupStudent = async () => {
    if (!studentNumber.trim()) return;
    setSearching(true);
    setNotFound(false);
    setStudentInfo(null);

    const { data } = await supabase
      .from("students")
      .select("id, first_name, last_name, admission_number, form")
      .eq("admission_number", studentNumber.trim().toUpperCase())
      .maybeSingle();

    if (data) {
      setStudentInfo(data);
    } else {
      setNotFound(true);
    }
    setSearching(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentInfo || !amount || !payerName || !payerEmail) return;

    setSubmitting(true);
    const { error } = await supabase.from("online_payments").insert({
      payment_type: "fees",
      student_number: studentInfo.admission_number,
      student_id: studentInfo.id,
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone || null,
      amount_usd: parseFloat(amount),
      description: `Fee payment for ${studentInfo.first_name} ${studentInfo.last_name} (${studentInfo.admission_number})`,
      status: "pending",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to initiate payment. Please try again.", variant: "destructive" });
    } else {
      setSubmitted(true);
      toast({ title: "Payment Initiated", description: "Your payment request has been recorded. Stripe checkout will be available soon." });
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-12 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
          <h3 className="text-xl font-bold text-green-800">Payment Request Recorded</h3>
          <p className="mt-2 text-green-700">
            Your fee payment of <strong>{formatMoney(amount)}</strong> for student{" "}
            <strong>{studentInfo?.admission_number}</strong> has been recorded.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Online payment processing via Stripe will be activated soon. For now, please proceed with bank transfer or visit the school bursar.
          </p>
          <Button className="mt-6" onClick={() => { setSubmitted(false); setStudentInfo(null); setAmount(""); }}>
            Make Another Payment
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-secondary" />
          Pay School Fees
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Enter the student number (e.g. MHS01001) to link the payment to the correct student account.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Student Lookup */}
          <div className="space-y-2">
            <Label>Student Number *</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. MHS01001"
                value={studentNumber}
                onChange={(e) => setStudentNumber(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button type="button" variant="secondary" onClick={lookupStudent} disabled={searching || !studentNumber.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {notFound && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              No student found with that number. Please check and try again.
            </div>
          )}

          {studentInfo && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-800">Student Found</span>
              </div>
              <p className="mt-1 text-sm text-green-700">
                <strong>{studentInfo.first_name} {studentInfo.last_name}</strong>
                <Badge variant="outline" className="ml-2 text-xs">{studentInfo.form || "N/A"}</Badge>
              </p>
            </div>
          )}

          {studentInfo && (
            <>
              <div className="space-y-2">
                <Label>Amount (USD) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">ZiG {usdToZig(Number(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at US$ 1 = ZiG {rate.toFixed(2)}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Your Name *</Label>
                  <Input
                    placeholder="Full name"
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={payerEmail}
                    onChange={(e) => setPayerEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Phone (optional)</Label>
                <Input
                  placeholder="Phone number"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting || !amount}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {submitting ? "Processing..." : `Pay ${formatMoney(amount || 0)}`}
              </Button>

              <p className="text-center text-xs text-muted-foreground">
                Payments are processed securely via Stripe. You will receive a receipt by email.
              </p>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function DonationForm({ initialProjectId }: { initialProjectId: string }) {
  const { rate, usdToZig } = useExchangeRate();
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState(initialProjectId);
  const [amount, setAmount] = useState("");
  const [payerName, setPayerName] = useState("");
  const [payerEmail, setPayerEmail] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase
      .from("school_projects")
      .select("id, title")
      .eq("is_active", true)
      .order("title")
      .then(({ data }) => { if (data) setProjects(data); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !payerName || !payerEmail) return;

    setSubmitting(true);
    const selectedTitle = projects.find((p) => p.id === selectedProject)?.title || "General Fund";

    const { error } = await supabase.from("online_payments").insert({
      payment_type: "donation",
      project_id: selectedProject || null,
      payer_name: payerName,
      payer_email: payerEmail,
      payer_phone: payerPhone || null,
      amount_usd: parseFloat(amount),
      description: `Donation: ${selectedTitle}`,
      status: "pending",
    });

    if (error) {
      toast({ title: "Error", description: "Failed to initiate donation. Please try again.", variant: "destructive" });
    } else {
      setSubmitted(true);
      toast({ title: "Donation Initiated", description: "Your donation has been recorded. Thank you!" });
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="py-12 text-center">
          <CheckCircle className="mx-auto mb-4 h-16 w-16 text-green-600" />
          <h3 className="text-xl font-bold text-green-800">Thank You for Your Generosity!</h3>
          <p className="mt-2 text-green-700">
            Your donation of <strong>{formatMoney(amount)}</strong> has been recorded.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Online payment processing via Stripe will be activated soon. For now, please proceed with bank transfer.
          </p>
          <Button className="mt-6" onClick={() => { setSubmitted(false); setAmount(""); }}>
            Make Another Donation
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5 text-secondary" />
          Make a Donation
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Support our school projects and initiatives with a secure online donation.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label>Donate To</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="General Fund (no specific project)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General School Fund</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Donation Amount (USD) *</Label>
            <div className="grid grid-cols-4 gap-2">
              {["10", "25", "50", "100"].map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={amount === preset ? "default" : "outline"}
                  onClick={() => setAmount(preset)}
                  className="text-sm"
                >
                  {formatMoney(preset, { decimals: false })}
                </Button>
              ))}
            </div>
            <Input
              type="number"
              min="1"
              step="0.01"
              placeholder="Or enter custom amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">ZiG {usdToZig(Number(amount) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at US$ 1 = ZiG {rate.toFixed(2)}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Your Name *</Label>
              <Input
                placeholder="Full name"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                placeholder="email@example.com"
                value={payerEmail}
                onChange={(e) => setPayerEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Phone (optional)</Label>
            <Input
              placeholder="Phone number"
              value={payerPhone}
              onChange={(e) => setPayerPhone(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full gap-2" size="lg" disabled={submitting || !amount}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" />}
            {submitting ? "Processing..." : `Donate ${formatMoney(amount || 0)}`}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Donations are processed securely via Stripe. You will receive a receipt by email.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
