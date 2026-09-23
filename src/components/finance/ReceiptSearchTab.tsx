import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Printer, Loader2, Eye, Download, FileText, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { buildReceiptHtml, SCHOOL_LOGO_URL } from "@/lib/finance/pdf";
import { openPrintWindow, downloadHtmlDocument } from "@/lib/finance/print";
import { generateAndStoreReceipt, isInstantMethod } from "@/lib/finance/receiptStorage";
import { errorMessage } from "@/lib/errors";
import { formatUSD } from "@/lib/currency";
import type { QueryData } from "@supabase/supabase-js";

const paymentsQuery = () =>
  supabase
    .from("payments")
    .select("*, students:student_id (full_name, admission_number, form), invoices:invoice_id (invoice_number)")
    .order("payment_date", { ascending: false });
type Receipt = QueryData<ReturnType<typeof paymentsQuery>>[number];

const fmt = formatUSD;

export default function ReceiptSearchTab() {
  const { toast } = useToast();
  const { usdToZig } = useExchangeRate();
  const [searchTerm, setSearchTerm] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Auto-search after 3 characters
  useEffect(() => {
    if (searchTerm.trim().length >= 3) {
      const timer = setTimeout(() => {
        searchReceipts();
      }, 400);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const searchReceipts = async () => {
    if (!searchTerm.trim()) {
      toast({ title: "Enter a search term", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSearched(true);
    const term = searchTerm.trim().toLowerCase();

    try {
      // Search payments with joined student & invoice data
      const { data, error } = await paymentsQuery();

      if (error) throw error;

      // Client-side filter for flexible matching
      const filtered = (data || []).filter((p) => {
        const receipt = (p.receipt_number || "").toLowerCase();
        const studentName = (p.students?.full_name || "").toLowerCase();
        const admNum = (p.students?.admission_number || "").toLowerCase();
        const invNum = (p.invoices?.invoice_number || "").toLowerCase();
        return (
          receipt.includes(term) ||
          studentName.includes(term) ||
          admNum.includes(term) ||
          invNum.includes(term)
        );
      });

      setReceipts(
        filtered.map((p) => ({
          ...p,
          amount_zig: Number(usdToZig(Number(p.amount_usd || 0)).toFixed(2)),
        })),
      );
    } catch (err) {
      toast({ title: "Search failed", description: errorMessage(err), variant: "destructive" });
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  const viewReceipt = (payment: Receipt) => {
    const receiptHtml = buildReceiptHtml({
      logoUrl: SCHOOL_LOGO_URL,
      receiptNumber: payment.receipt_number,
      paymentDate: payment.payment_date,
      student: {
        fullName: payment.students?.full_name || "—",
        admissionNumber: payment.students?.admission_number || "—",
        form: payment.students?.form || "—",
      },
      invoiceNumber: payment.invoices?.invoice_number,
      amounts: {
        usd: payment.amount_usd,
        zig: payment.amount_zig,
      },
      paymentMethod: payment.payment_method,
      referenceNumber: payment.reference_number,
    });
    const w = window.open("", "_blank");
    if (w) {
      w.document.open();
      w.document.write(receiptHtml);
      w.document.close();
    }
  };

  const printReceipt = (payment: Receipt) => {
    const receiptHtml = buildReceiptHtml({
      logoUrl: SCHOOL_LOGO_URL,
      receiptNumber: payment.receipt_number,
      paymentDate: payment.payment_date,
      student: {
        fullName: payment.students?.full_name || "—",
        admissionNumber: payment.students?.admission_number || "—",
        form: payment.students?.form || "—",
      },
      invoiceNumber: payment.invoices?.invoice_number,
      amounts: {
        usd: payment.amount_usd,
        zig: payment.amount_zig,
      },
      paymentMethod: payment.payment_method,
      referenceNumber: payment.reference_number,
    });
    openPrintWindow(receiptHtml);
  };

  const downloadReceipt = async (payment: Receipt) => {
    if (payment.receipt_url) {
      // Prefer the stored PDF file
      window.open(payment.receipt_url, "_blank");
      return;
    }
    const html = buildReceiptHtml({
      logoUrl: SCHOOL_LOGO_URL,
      receiptNumber: payment.receipt_number,
      paymentDate: payment.payment_date,
      student: {
        fullName: payment.students?.full_name || "—",
        admissionNumber: payment.students?.admission_number || "—",
        form: payment.students?.form || "—",
      },
      invoiceNumber: payment.invoices?.invoice_number,
      amounts: { usd: payment.amount_usd, zig: payment.amount_zig },
      paymentMethod: payment.payment_method,
      referenceNumber: payment.reference_number,
    });
    await downloadHtmlDocument(html, `Receipt-${payment.receipt_number}.pdf`);
  };

  const [backfilling, setBackfilling] = useState(false);
  const backfillMissing = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase
        .from("payments")
        .select(`id, receipt_number, payment_date, payment_method, reference_number, amount_usd, amount, receipt_url, payment_status,
                 students:student_id (full_name, admission_number, form),
                 invoices:invoice_id (invoice_number)`)
        .eq("payment_status", "paid")
        .is("receipt_url", null);
      if (error) throw error;
      const targets = (data || []).filter((p) => isInstantMethod(p.payment_method) && p.receipt_number);
      let ok = 0;
      for (const p of targets) {
        const url = await generateAndStoreReceipt({
          paymentId: p.id,
          receiptNumber: p.receipt_number,
          paymentDate: p.payment_date,
          paymentMethod: p.payment_method,
          referenceNumber: p.reference_number,
          amount: Number(p.amount_usd || p.amount || 0),
          student: {
            fullName: p.students?.full_name || "—",
            admissionNumber: p.students?.admission_number || "—",
            form: p.students?.form || null,
          },
          invoiceNumber: p.invoices?.invoice_number,
          autoVerify: true,
        });
        if (url) ok += 1;
      }
      toast({ title: "Backfill complete", description: `${ok} of ${targets.length} receipts generated.` });
      searchReceipts();
    } catch (e) {
      toast({ title: "Backfill failed", description: errorMessage(e), variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="font-heading">Receipt Search</CardTitle>
            <CardDescription>Search by student name, admission number, receipt number, or invoice number.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={backfillMissing} disabled={backfilling}>
            {backfilling ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Backfill missing receipts
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by student name, admission #, receipt #, or invoice #"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => e.key === "Enter" && searchReceipts()}
            />
          </div>
          <Button onClick={searchReceipts} disabled={loading}>
            {loading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
            Search
          </Button>
        </div>

        {searched && receipts.length === 0 && !loading && (
          <p className="text-center py-8 text-muted-foreground">No receipts found.</p>
        )}

        {receipts.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Adm #</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receipts.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                    <TableCell>{format(new Date(p.payment_date), "dd MMM yyyy")}</TableCell>
                    <TableCell>{p.students?.full_name}</TableCell>
                    <TableCell>{p.students?.admission_number}</TableCell>
                    <TableCell className="font-mono text-xs">{p.invoices?.invoice_number || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{fmt(p.amount_usd)}</TableCell>
                    <TableCell>{p.payment_method}</TableCell>
                    <TableCell>
                      {p.verified_at ? (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-700 bg-emerald-50">Verified</Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {p.receipt_url && (
                          <Button variant="ghost" size="icon" asChild title="Open saved PDF">
                            <a href={p.receipt_url} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => viewReceipt(p)} title="View Receipt">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => printReceipt(p)} title="Print Receipt">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => downloadReceipt(p)} title="Download Receipt PDF">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
