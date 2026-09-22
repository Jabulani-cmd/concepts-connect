// @ts-nocheck
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { safeHtml } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Trash2, Search, CheckCircle, AlertTriangle, Loader2, Printer } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { buildBrandedHtml } from "@/lib/print/printSection";
import { openPrintWindow } from "@/lib/finance/print";

const fmt = (n: any): string => { const v=Number(n); return "US$ " + new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number.isFinite(v)?v:0); };

export default function BankReconciliation() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { rate, usdToZig } = useExchangeRate();
  const convertUsdToZig = useCallback(
    (usdValue: any) => {
      const usd = Number(usdValue);
      return Number.isFinite(usd) ? Number(usdToZig(usd).toFixed(2)) : 0;
    },
    [usdToZig],
  );
  const autoZig = useCallback(
    (usd: string) => {
      const n = Number(usd);
      return Number.isFinite(n) ? convertUsdToZig(n).toFixed(2) : "";
    },
    [convertUsdToZig],
  );
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().split("T")[0],
    description: "",
    reference_number: "",
    transaction_type: "credit",
    amount_usd: "",
    amount_zig: "",
    bank_name: "",
    account_number: "",
    notes: "",
  });

  useEffect(() => { fetchTransactions(); }, [rate]);

  async function fetchTransactions() {
    setLoading(true);
    const { data } = await supabase
      .from("bank_transactions")
      .select("*")
      .order("transaction_date", { ascending: false });
    if (data) {
      setTransactions(data.map((tx: any) => ({ ...tx, amount_zig: convertUsdToZig(tx.amount_usd) })));
    }
    setLoading(false);
  }

  async function saveTransaction() {
    setSaving(true);
    const amountUsd = parseFloat(form.amount_usd) || 0;
    const { error } = await supabase.from("bank_transactions").insert({
      transaction_date: form.transaction_date,
      description: form.description,
      reference_number: form.reference_number || null,
      transaction_type: form.transaction_type,
      amount_usd: amountUsd,
      amount_zig: convertUsdToZig(amountUsd),
      bank_name: form.bank_name || null,
      account_number: form.account_number || null,
      notes: form.notes || null,
      recorded_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Bank transaction recorded" });
      setDialogOpen(false);
      fetchTransactions();
    }
    setSaving(false);
  }

  async function toggleReconciled(tx: any) {
    const newStatus = tx.reconciliation_status === "reconciled" ? "unreconciled" : "reconciled";
    await supabase.from("bank_transactions").update({ reconciliation_status: newStatus }).eq("id", tx.id);
    toast({ title: newStatus === "reconciled" ? "Marked as reconciled" : "Marked as unreconciled" });
    fetchTransactions();
  }

  async function markDisputed(tx: any) {
    await supabase.from("bank_transactions").update({ reconciliation_status: "disputed" }).eq("id", tx.id);
    toast({ title: "Marked as disputed" });
    fetchTransactions();
  }

  async function deleteTransaction(id: string) {
    await supabase.from("bank_transactions").delete().eq("id", id);
    toast({ title: "Transaction deleted" });
    fetchTransactions();
  }

  const filtered = transactions.filter(tx => {
    if (statusFilter !== "all" && tx.reconciliation_status !== statusFilter) return false;
    if (typeFilter !== "all" && tx.transaction_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        tx.description?.toLowerCase().includes(s) ||
        tx.reference_number?.toLowerCase().includes(s) ||
        tx.bank_name?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const totalCreditsUsd = filtered.filter(t => t.transaction_type === "credit").reduce((s, t) => s + Number(t.amount_usd), 0);
  const totalDebitsUsd = filtered.filter(t => t.transaction_type === "debit").reduce((s, t) => s + Number(t.amount_usd), 0);
  const reconciledCount = filtered.filter(t => t.reconciliation_status === "reconciled").length;
  const unreconciledCount = filtered.filter(t => t.reconciliation_status === "unreconciled").length;
  const disputedCount = filtered.filter(t => t.reconciliation_status === "disputed").length;

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      reconciled: "bg-green-100 text-green-800 border-green-300",
      unreconciled: "bg-amber-100 text-amber-800 border-amber-300",
      disputed: "bg-red-100 text-red-800 border-red-300",
    };
    return <Badge variant="outline" className={map[status] || ""}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
  };

  function printReconciliation() {
    const rows = filtered.map(tx => `<tr><td>${safeHtml(tx.transaction_date)}</td><td>${safeHtml(tx.description)}</td><td>${safeHtml(tx.reference_number || "—")}</td><td>${safeHtml(tx.bank_name || "—")}</td><td>${safeHtml(tx.transaction_type)}</td><td>${tx.transaction_type === "credit" ? "+" : "-"}${safeHtml(formatMoney(tx.amount_usd))}</td><td>${safeHtml(tx.reconciliation_status)}</td></tr>`).join("");
    const bodyHtml = `<p><strong>Credits:</strong> ${safeHtml(formatMoney(totalCreditsUsd))} &nbsp; <strong>Debits:</strong> ${safeHtml(formatMoney(totalDebitsUsd))} &nbsp; <strong>Net:</strong> ${safeHtml(formatMoney(totalCreditsUsd - totalDebitsUsd))}</p><p>Reconciled: ${reconciledCount} | Unreconciled: ${unreconciledCount} | Disputed: ${disputedCount}</p><table><thead><tr><th>Date</th><th>Description</th><th>Ref</th><th>Bank</th><th>Type</th><th>Amount (US$ / ZiG)</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    openPrintWindow(buildBrandedHtml({ title: "Bank Reconciliation Report", bodyHtml }));
  }

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Credits</p>
            <p className="text-base font-bold font-mono text-green-700">{formatMoney(totalCreditsUsd)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Debits</p>
            <p className="text-base font-bold font-mono text-destructive">{formatMoney(totalDebitsUsd)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Net Balance</p>
            <p className={`text-xl font-bold font-mono ${totalCreditsUsd - totalDebitsUsd >= 0 ? "text-green-700" : "text-destructive"}`}>
              {formatMoney(totalCreditsUsd - totalDebitsUsd)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Reconciliation</p>
            <div className="flex gap-2 mt-1">
              <span className="text-xs text-green-700">✓ {reconciledCount}</span>
              <span className="text-xs text-amber-700">○ {unreconciledCount}</span>
              <span className="text-xs text-destructive">⚠ {disputedCount}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="font-heading">Bank Reconciliation</CardTitle>
            <CardDescription>Match bank statement entries with system records</CardDescription>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={printReconciliation}><Printer className="mr-1 h-4 w-4" /> Print</Button>
            <Button onClick={() => { setForm({ transaction_date: new Date().toISOString().split("T")[0], description: "", reference_number: "", transaction_type: "credit", amount_usd: "", amount_zig: "", bank_name: "", account_number: "", notes: "" }); setDialogOpen(true); }} className="bg-accent hover:bg-accent/90 text-accent-foreground">
              <Plus className="mr-1 h-4 w-4" /> Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search description, reference, bank…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="unreconciled">Unreconciled</SelectItem>
                <SelectItem value="reconciled">Reconciled</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="credit">Credits</SelectItem>
                <SelectItem value="debit">Debits</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No bank transactions found.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Bank</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(tx => (
                    <TableRow key={tx.id} className={tx.reconciliation_status === "reconciled" ? "bg-green-50/30" : tx.reconciliation_status === "disputed" ? "bg-red-50/30" : ""}>
                      <TableCell className="text-xs">{tx.transaction_date}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell className="font-mono text-xs">{tx.reference_number || "—"}</TableCell>
                      <TableCell className="text-xs">{tx.bank_name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tx.transaction_type === "credit" ? "bg-green-100 text-green-800 border-green-300" : "bg-red-100 text-red-800 border-red-300"}>
                          {tx.transaction_type === "credit" ? "Credit" : "Debit"}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-mono ${tx.transaction_type === "credit" ? "text-green-700" : "text-destructive"}`}>
                        {tx.transaction_type === "credit" ? "+" : "-"}{formatMoney(tx.amount_usd)}
                      </TableCell>
                      <TableCell>{statusBadge(tx.reconciliation_status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" title={tx.reconciliation_status === "reconciled" ? "Unreconcile" : "Reconcile"} onClick={() => toggleReconciled(tx)}>
                            <CheckCircle className={`h-4 w-4 ${tx.reconciliation_status === "reconciled" ? "text-green-600" : "text-muted-foreground"}`} />
                          </Button>
                          {tx.reconciliation_status !== "disputed" && (
                            <Button variant="ghost" size="icon" title="Mark disputed" onClick={() => markDisputed(tx)}>
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => deleteTransaction(tx.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Add Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Bank Transaction</DialogTitle>
            <DialogDescription>Record a bank statement entry for reconciliation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.transaction_date} onChange={e => setForm(p => ({ ...p, transaction_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select value={form.transaction_type} onValueChange={v => setForm(p => ({ ...p, transaction_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="credit">Credit (Incoming)</SelectItem>
                    <SelectItem value="debit">Debit (Outgoing)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Bank statement description" />
            </div>
            <div className="space-y-1">
              <Label>Amount (US$)</Label>
              <Input type="number" step="0.01" value={form.amount_usd} onChange={e => setForm(p => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))} />
              <p className="text-xs text-muted-foreground">ZiG {form.amount_zig || "0.00"} at US$ 1 = ZiG {rate.toFixed(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Bank Name</Label>
                <Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Account Number</Label>
                <Input value={form.account_number} onChange={e => setForm(p => ({ ...p, account_number: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reference Number</Label>
              <Input value={form.reference_number} onChange={e => setForm(p => ({ ...p, reference_number: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveTransaction} disabled={saving || !form.description}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
