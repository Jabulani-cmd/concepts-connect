import { safeHtml } from "@/lib/utils";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import DocActionButtons from "@/components/finance/DocActionButtons";
import { incomeExpenditureActions } from "@/lib/finance/documentActions";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatMoney, formatUSD, fmtUSD } from "@/lib/currency";
import type { Tables } from "@/integrations/supabase/types";
import type { QueryData } from "@supabase/supabase-js";

const fmt = formatUSD;
/** Formats an amount that is already in ZiG. */
const fmtZ = (zig: number): string => `ZiG ${fmtUSD(zig)}`;

const paymentsQuery = () => supabase.from("payments").select("*, students(full_name)").order("payment_date", { ascending: false });
const supplierPaymentsQuery = () =>
  supabase.from("supplier_payments").select("*, supplier_invoices(supplier_name)").order("payment_date", { ascending: false });
type Payment = QueryData<ReturnType<typeof paymentsQuery>>[number];
type SupplierPayment = QueryData<ReturnType<typeof supplierPaymentsQuery>>[number];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function IncomeExpenditureReport() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const { rate, usdToZig } = useExchangeRate();

  const convertUsdToZig = useCallback(
    (usdValue: unknown) => {
      const usd = Number(usdValue);
      return Number.isFinite(usd) ? Number(usdToZig(usd).toFixed(2)) : 0;
    },
    [usdToZig],
  );
  const normalizeAmount = useCallback(
    <T extends { amount_usd: number }>(row: T): T & { amount_zig: number } => ({
      ...row,
      amount_zig: convertUsdToZig(row.amount_usd),
    }),
    [convertUsdToZig],
  );

  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Tables<"expenses">[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState(String(currentMonth));
  const [search, setSearch] = useState("");

  useEffect(() => { fetchData(); }, [rate]);

  async function fetchData() {
    setLoading(true);
    const [payRes, expRes, spRes] = await Promise.all([
      paymentsQuery(),
      supabase.from("expenses").select("*").order("expense_date", { ascending: false }),
      supplierPaymentsQuery(),
    ]);
    if (payRes.data) setPayments(payRes.data.map(normalizeAmount));
    if (expRes.data) setExpenses(expRes.data.map(normalizeAmount));
    if (spRes.data) setSupplierPayments(spRes.data.map(normalizeAmount));
    setLoading(false);
  }

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    payments.forEach(p => years.add(new Date(p.payment_date).getFullYear().toString()));
    expenses.forEach(e => years.add(new Date(e.expense_date).getFullYear().toString()));
    years.add(String(currentYear));
    return Array.from(years).sort().reverse();
  }, [payments, expenses]);

  // Filter by selected month/year
  const filterByMonth = (date: string) => {
    const d = new Date(date);
    return d.getFullYear() === Number(selectedYear) && d.getMonth() === Number(selectedMonth);
  };

  const monthPayments = payments.filter(p => filterByMonth(p.payment_date));
  const monthExpenses = expenses.filter(e => filterByMonth(e.expense_date));
  const monthSupplierPayments = supplierPayments.filter(sp => filterByMonth(sp.payment_date));

  // Apply search
  const searchedPayments = monthPayments.filter(p => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.students?.full_name?.toLowerCase().includes(s) || p.receipt_number?.toLowerCase().includes(s) || p.payment_method?.toLowerCase().includes(s);
  });

  const searchedExpenses = monthExpenses.filter(e => {
    if (!search) return true;
    const s = search.toLowerCase();
    return e.description?.toLowerCase().includes(s) || e.category?.toLowerCase().includes(s);
  });

  const searchedSupplierPayments = monthSupplierPayments.filter(sp => {
    if (!search) return true;
    const s = search.toLowerCase();
    return sp.supplier_invoices?.supplier_name?.toLowerCase().includes(s) || sp.reference?.toLowerCase().includes(s);
  });

  // Totals
  const totalIncomeUsd = searchedPayments.reduce((s, p) => s + Number(p.amount_usd || 0), 0);
  const totalIncomeZig = searchedPayments.reduce((s, p) => s + Number(p.amount_zig || 0), 0);
  const totalExpensesUsd = searchedExpenses.reduce((s, e) => s + Number(e.amount_usd || 0), 0);
  const totalExpensesZig = searchedExpenses.reduce((s, e) => s + Number(e.amount_zig || 0), 0);
  const totalSupplierUsd = searchedSupplierPayments.reduce((s, sp) => s + Number(sp.amount_usd || 0), 0);
  const totalSupplierZig = searchedSupplierPayments.reduce((s, sp) => s + Number(sp.amount_zig || 0), 0);
  const totalOutUsd = totalExpensesUsd + totalSupplierUsd;
  const totalOutZig = totalExpensesZig + totalSupplierZig;
  const netUsd = totalIncomeUsd - totalOutUsd;
  const netZig = totalIncomeZig - totalOutZig;

  // Expense breakdown by category
  const expenseByCategory = useMemo(() => {
    const map: Record<string, { usd: number; zig: number }> = {};
    searchedExpenses.forEach(e => {
      const cat = e.category || "General";
      if (!map[cat]) map[cat] = { usd: 0, zig: 0 };
      map[cat].usd += Number(e.amount_usd || 0);
      map[cat].zig += Number(e.amount_zig || 0);
    });
    return Object.entries(map).sort((a, b) => b[1].usd - a[1].usd);
  }, [searchedExpenses]);

  const periodLabel = `${months[Number(selectedMonth)]} ${selectedYear}`;
  const docActions = () => incomeExpenditureActions({
    periodLabel,
    income: searchedPayments.map((p) => ({
      date: p.payment_date,
      receipt: p.receipt_number,
      party: p.students?.full_name || "—",
      method: p.payment_method,
      usd: Number(p.amount_usd || 0),
      zig: Number(p.amount_zig || 0),
      ref: p.reference_number,
    })),
    expenses: searchedExpenses.map((e) => ({
      date: e.expense_date,
      category: e.category || "General",
      description: e.description || "",
      method: e.payment_method,
      usd: Number(e.amount_usd || 0),
      zig: Number(e.amount_zig || 0),
    })),
    supplierPayments: searchedSupplierPayments.map((sp) => ({
      date: sp.payment_date,
      supplier: sp.supplier_invoices?.supplier_name || "—",
      method: sp.payment_method,
      ref: sp.reference,
      usd: Number(sp.amount_usd || 0),
      zig: Number(sp.amount_zig || 0),
    })),
    totals: {
      incomeUsd: totalIncomeUsd, incomeZig: totalIncomeZig,
      expensesUsd: totalExpensesUsd, expensesZig: totalExpensesZig,
      supplierUsd: totalSupplierUsd, supplierZig: totalSupplierZig,
      netUsd, netZig,
    },
    breakdownByCategory: expenseByCategory.map(([category, totals]) => ({
      category, usd: totals.usd, zig: totals.zig,
    })),
  });


  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters Row */}
      <div className="flex gap-3 flex-wrap items-end">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {yearOptions.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => <SelectItem key={i} value={String(i)}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search transactions…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <DocActionButtons
          actions={docActions}
          labels
          email={{
            documentLabel: "income & expenditure report",
            filename: `income-expenditure-${periodLabel.replace(/\s+/g, "-").toLowerCase()}`,
            subject: `Income & Expenditure Report — ${periodLabel}`,
          }}
        />
      </div>


      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-700" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Income</p>
            </div>
            <p className="text-xl font-bold font-mono text-green-700">{fmt(totalIncomeUsd)}</p>
            <p className="text-sm font-mono text-muted-foreground">{fmtZ(totalIncomeZig)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Expenses</p>
            </div>
            <p className="text-xl font-bold font-mono text-destructive">{fmt(totalOutUsd)}</p>
            <p className="text-sm font-mono text-muted-foreground">{fmtZ(totalOutZig)}</p>
          </CardContent>
        </Card>
        <Card className={netUsd >= 0 ? "bg-green-50/50 border-green-200" : "bg-destructive/5 border-destructive/30"}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Net</p>
            </div>
            <p className={`text-xl font-bold font-mono ${netUsd >= 0 ? "text-green-700" : "text-destructive"}`}>{fmt(netUsd)}</p>
            <p className="text-sm font-mono text-muted-foreground">{fmtZ(netZig)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
            <p className="text-xl font-bold">{searchedPayments.length + searchedExpenses.length + searchedSupplierPayments.length}</p>
            <p className="text-xs text-muted-foreground">{searchedPayments.length} income · {searchedExpenses.length + searchedSupplierPayments.length} expense</p>
          </CardContent>
        </Card>
      </div>

      {/* Expense Breakdown by Category */}
      {expenseByCategory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-heading">Expense Breakdown by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expenseByCategory.map(([cat, totals]) => (
                <div key={cat} className="flex items-center justify-between text-sm border-b pb-1">
                  <span><Badge variant="outline">{cat}</Badge></span>
                  <span className="font-mono">{fmt(totals.usd)} / {fmtZ(totals.zig)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Income Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-green-700">Income — {months[Number(selectedMonth)]} {selectedYear}</CardTitle>
          <CardDescription>{searchedPayments.length} payment(s) totalling {fmt(totalIncomeUsd)}</CardDescription>
        </CardHeader>
        <CardContent>
          {searchedPayments.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">No income recorded for this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Receipt #</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {searchedPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{p.payment_date}</TableCell>
                      <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                      <TableCell>{p.students?.full_name || "—"}</TableCell>
                      <TableCell>{p.payment_method}</TableCell>
                      <TableCell className="text-right font-mono text-green-700">{formatMoney(p.amount_usd)}</TableCell>
                      <TableCell className="text-xs">{p.reference_number || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-destructive">Expenditure — {months[Number(selectedMonth)]} {selectedYear}</CardTitle>
          <CardDescription>{searchedExpenses.length} expense(s) + {searchedSupplierPayments.length} supplier payment(s) totalling {fmt(totalOutUsd)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchedExpenses.length === 0 && searchedSupplierPayments.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground">No expenditure recorded for this period.</p>
          ) : (
            <>
              {searchedExpenses.length > 0 && (
                <div className="overflow-x-auto">
                  <h4 className="text-sm font-semibold mb-2">General Expenses</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchedExpenses.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs">{e.expense_date}</TableCell>
                          <TableCell><Badge variant="outline">{e.category}</Badge></TableCell>
                          <TableCell className="max-w-[250px] truncate">{e.description}</TableCell>
                          <TableCell>{e.payment_method}</TableCell>
                          <TableCell className="text-right font-mono text-destructive">{formatMoney(e.amount_usd)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {searchedSupplierPayments.length > 0 && (
                <div className="overflow-x-auto">
                  <h4 className="text-sm font-semibold mb-2">Supplier Payments</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                        <TableHead>Reference</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchedSupplierPayments.map(sp => (
                        <TableRow key={sp.id}>
                          <TableCell className="text-xs">{sp.payment_date}</TableCell>
                          <TableCell>{sp.supplier_invoices?.supplier_name || "—"}</TableCell>
                          <TableCell>{sp.payment_method}</TableCell>
                          <TableCell className="text-right font-mono text-destructive">{formatMoney(sp.amount_usd)}</TableCell>
                          <TableCell className="text-xs">{sp.reference || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
