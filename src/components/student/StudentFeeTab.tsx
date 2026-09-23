import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import DocActionButtons from "@/components/finance/DocActionButtons";
import DateRangeFilter from "@/components/finance/DateRangeFilter";
import { dateMatches, emptyDateFilter, type FinanceDateFilter } from "@/lib/finance/dateFilter";
import {
  invoiceActions,
  receiptActions,
  statementActions,
} from "@/lib/finance/documentActions";
import { formatMoney } from "@/lib/currency";
import CurrencyConverter from "@/components/finance/CurrencyConverter";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  studentId: string | null;
}

type FeePayment = Tables<"payments"> & { invoices?: { invoice_number: string | null } | null };

export default function StudentFeeTab({ studentId }: Props) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [invoices, setInvoices] = useState<Tables<"invoices">[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [student, setStudent] = useState<Pick<Tables<"students">, "full_name" | "admission_number" | "form"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<FinanceDateFilter>(emptyDateFilter());
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [invRes, payRes, stuRes] = await Promise.all([
      supabase
        .from("invoices")
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*, invoices(invoice_number)")
        .eq("student_id", studentId)
        .order("payment_date", { ascending: false }),
      supabase
        .from("students")
        .select("full_name, admission_number, form")
        .eq("id", studentId)
        .maybeSingle(),
    ]);
    if (invRes.error) toast({ title: "Error", description: invRes.error.message, variant: "destructive" });
    else setInvoices(invRes.data || []);
    if (payRes.error) toast({ title: "Error", description: payRes.error.message, variant: "destructive" });
    else setPayments(payRes.data || []);
    setStudent(stuRes.data || null);
    setLoading(false);
  }, [studentId, toast]);

  useEffect(() => {
    if (!studentId) { setLoading(false); return; }
    fetchData();
    const ch = supabase
      .channel(`student-fees-${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments", filter: `student_id=eq.${studentId}` }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices", filter: `student_id=eq.${studentId}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchData, studentId]);

  const docStudent = {
    fullName: student?.full_name || "—",
    admissionNumber: student?.admission_number || "—",
    form: student?.form || null,
  };

  const totalInvoicedUsd = invoices.reduce((sum, i) => sum + Number(i.total_usd), 0);
  const totalPaidUsd = invoices.reduce((sum, i) => sum + Number(i.paid_usd), 0);
  const balanceUsd = totalInvoicedUsd - totalPaidUsd;

  const statusBadge = (status: string) => (
    <Badge
      variant="outline"
      className={
        status === "paid"
          ? "bg-green-100 text-green-800"
          : status === "partial"
            ? "bg-amber-100 text-amber-800"
            : "bg-red-100 text-red-800"
      }
    >
      {status}
    </Badge>
  );

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  const q = searchTerm.trim().toLowerCase();
  const matchesSearch = (text?: string | null) =>
    !q || (text || "").toString().toLowerCase().includes(q);

  const filteredInvoices = invoices.filter((i) =>
    dateMatches(dateFilter, i.created_at || i.due_date) &&
    (matchesSearch(i.invoice_number) || matchesSearch(i.term) || matchesSearch(i.academic_year) || matchesSearch(i.status)),
  );
  const filteredPayments = payments.filter((p) =>
    dateMatches(dateFilter, p.payment_date) &&
    (matchesSearch(p.receipt_number) || matchesSearch(p.invoices?.invoice_number) || matchesSearch(p.payment_method) || matchesSearch(p.reference_number)),
  );

  const stmtActions = statementActions(docStudent, filteredInvoices, filteredPayments);
  const stmtEmail = {
    documentLabel: "Student Statement",
    filename: `statement-${(student?.full_name || "student").replace(/\s+/g, "-").toLowerCase()}`,
    subject: `Statement of Account — ${student?.full_name || "Student"}`,
  };

  return (
    <div className="space-y-4">
      <CurrencyConverter />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
        <div>
          <h2 className="text-lg font-bold">Fee Statement</h2>
          <p className="text-sm text-muted-foreground">All invoices and payments</p>
        </div>
        {(invoices.length > 0 || filteredPayments.length > 0) && (
          <DocActionButtons actions={stmtActions} labels email={stmtEmail} />
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search invoice #, receipt #, term, method…"
            className="pl-9"
          />
        </div>
        <DateRangeFilter value={dateFilter} onChange={setDateFilter} />
      </div>


      {/* Balance summary */}
      <Card
        className={
          balanceUsd < 0
            ? "bg-green-50 border-green-200"
            : balanceUsd > 0
              ? "bg-destructive/5 border-destructive/30"
              : ""
        }
      >
        <CardContent className="p-4 flex items-center gap-4">
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold ${balanceUsd < 0 ? "bg-green-100 text-green-600" : balanceUsd > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}
          >
             $
          </span>
          <div className="min-w-0">
            <p
              className={`text-2xl font-bold ${balanceUsd < 0 ? "text-green-600" : balanceUsd > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {balanceUsd < 0 ? `${formatMoney(Math.abs(balanceUsd))} credit` : formatMoney(balanceUsd)}
            </p>
            <p className="text-sm text-muted-foreground">
              {balanceUsd < 0 ? "Credit Balance" : balanceUsd > 0 ? "Outstanding Balance" : "No Balance"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 break-words">
              Invoiced: {formatMoney(totalInvoicedUsd)} · Paid: {formatMoney(totalPaidUsd)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Invoices</CardTitle>
        </CardHeader>
        <CardContent className={isMobile ? "px-3 pb-3" : "p-0"}>
          {filteredInvoices.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No invoices found.</p>
          ) : isMobile ? (
            <div className="space-y-2">
              {filteredInvoices.map((inv) => {
                const actualPaid = Number(inv.paid_usd || inv.amount_paid || 0);
                const balance = inv.total_usd - actualPaid;
                return (
                  <Card key={inv.id} className="border">
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium">{inv.invoice_number}</span>
                        <div className="flex items-center gap-2">
                          {statusBadge(inv.status)}
                          <DocActionButtons labels actions={() => invoiceActions(inv, docStudent)} email={{ documentLabel: "Invoice", filename: `invoice-${inv.invoice_number}`, subject: `Invoice ${inv.invoice_number} — ${docStudent.fullName}` }} />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{inv.term} {inv.academic_year}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                        <span className="text-muted-foreground">Total:</span>
                        <span className="text-right font-mono">{formatMoney(inv.total_usd)}</span>
                        <span className="text-muted-foreground">Paid:</span>
                        <span className="text-right font-mono">{formatMoney(actualPaid)}</span>
                        <span className="text-muted-foreground">Balance:</span>
                        <span className={`text-right font-mono ${balance < 0 ? "text-green-600" : ""}`}>
                          {balance < 0 ? `+${formatMoney(Math.abs(balance))} credit` : formatMoney(balance)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="text-right">Total (US$)</TableHead>
                    <TableHead className="text-right">Paid (US$)</TableHead>
                    <TableHead className="text-right">Balance (US$)</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Document</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((inv) => {
                    const actualPaid = Number(inv.paid_usd || inv.amount_paid || 0);
                    const balance = inv.total_usd - actualPaid;
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                        <TableCell>{inv.term} {inv.academic_year}</TableCell>
                        <TableCell className="text-right">{formatMoney(inv.total_usd)}</TableCell>
                        <TableCell className="text-right">{formatMoney(actualPaid)}</TableCell>
                        <TableCell className="text-right">
                          {balance < 0 ? (
                            <span className="text-green-600">+{formatMoney(Math.abs(balance))} credit</span>
                          ) : (
                            formatMoney(balance)
                          )}
                        </TableCell>
                        <TableCell className="text-center">{statusBadge(inv.status)}</TableCell>
                        <TableCell className="text-center">
                          <DocActionButtons labels actions={() => invoiceActions(inv, docStudent)} email={{ documentLabel: "Invoice", filename: `invoice-${inv.invoice_number}`, subject: `Invoice ${inv.invoice_number} — ${docStudent.fullName}` }} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment history */}
      {filteredPayments.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Payment History</CardTitle>
          </CardHeader>
          <CardContent className={isMobile ? "px-3 pb-3" : "p-0"}>
            {isMobile ? (
              <div className="space-y-2">
                {filteredPayments.map((p) => (
                  <Card key={p.id} className="border">
                    <CardContent className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-medium">{p.receipt_number}</span>
                        <DocActionButtons labels actions={receiptActions(p, docStudent)} email={{ documentLabel: "Receipt", filename: `receipt-${p.receipt_number}`, subject: `Official Receipt ${p.receipt_number}` }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.payment_date), "dd MMM yyyy")} · {p.payment_method}
                      </p>
                      {p.invoices?.invoice_number && (
                        <p className="text-xs text-muted-foreground">Invoice: {p.invoices.invoice_number}</p>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-1">
                        <span className="text-muted-foreground">Amount:</span>
                        <span className="text-right font-mono font-medium">{formatMoney(p.amount_usd || p.amount || 0)}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-center">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                        <TableCell>{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                        <TableCell className="font-mono text-xs">{p.invoices?.invoice_number || "—"}</TableCell>
                        <TableCell className="text-right font-mono">{formatMoney(p.amount_usd || p.amount || 0)}</TableCell>
                        <TableCell>{p.payment_method}</TableCell>
                        <TableCell className="text-center">
                          <DocActionButtons labels actions={receiptActions(p, docStudent)} email={{ documentLabel: "Receipt", filename: `receipt-${p.receipt_number}`, subject: `Official Receipt ${p.receipt_number}` }} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
