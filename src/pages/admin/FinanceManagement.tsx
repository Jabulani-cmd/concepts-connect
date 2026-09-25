import ExchangeRateCard from "@/components/finance/ExchangeRateCard";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { OFFICE_PAYMENT_METHODS, paymentMethodLabel, type PaymentMethod } from "@/lib/finance/paymentMethods";
import { useAuth } from "@/contexts/AuthContext";
import {
  buildInvoicePdf,
  urlToDataUrl,
  buildReceiptHtml,
  SCHOOL_LOGO_URL,
} from "@/lib/finance/pdf";
import ReceiptSearchTab from "@/components/finance/ReceiptSearchTab";
import { openPrintWindow, downloadHtmlDocument } from "@/lib/finance/print";
import { formatMoney } from "@/lib/currency";
import DocActionButtons from "@/components/finance/DocActionButtons";
import DateRangeFilter from "@/components/finance/DateRangeFilter";
import { dateMatches, emptyDateFilter, type FinanceDateFilter } from "@/lib/finance/dateFilter";
import { invoiceActions, receiptActions, statementActions, expensesListActions } from "@/lib/finance/documentActions";
import {
  DollarSign,
  Plus,
  Pencil,
  Trash2,
  Copy,
  FileText,
  CreditCard,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Search,
  Download,
  Receipt,
  Ban,
  BarChart3,
  Loader2,
  Printer,
  User,
  ArrowLeft,
  RefreshCw,
  CheckCircle,
  ChevronDown,
  Truck,
} from "lucide-react";
import { safeHtml } from "@/lib/utils";
import { buildBrandedHtml } from "@/lib/print/printSection";
import BankReconciliation from "@/components/admin/BankReconciliation";
import IncomeExpenditureReport from "@/components/admin/IncomeExpenditureReport";
import { errorMessage } from "@/lib/errors";
import { ilikeAny } from "@/lib/search";
import { DEFAULT_FORM, FORM_LEVELS } from "@/lib/forms";

type FeeStructure = Tables<"fee_structures">;
type StudentRef = Pick<Tables<"students">, "full_name" | "admission_number" | "form">;
type Invoice = Tables<"invoices"> & { students?: StudentRef | null };
type Payment = Tables<"payments"> & {
  students?: StudentRef | null;
  invoices?: Pick<Tables<"invoices">, "invoice_number"> | null;
};
type Expense = Tables<"expenses">;
type PettyCash = Tables<"petty_cash">;
type SupplierInvoice = Tables<"supplier_invoices">;
type SupplierPayment = Tables<"supplier_payments"> & {
  supplier_invoices?: Pick<SupplierInvoice, "supplier_name" | "invoice_number"> | null;
};
type InvoiceItem = Tables<"invoice_items">;
type StudentHit = Pick<Tables<"students">, "id" | "full_name" | "admission_number" | "form"> & {
  boarding_status?: string | null;
};

const termOptions = ["Term 1", "Term 2", "Term 3"];
const boardingOptions = [
  { value: "day", label: "Day Scholar" },
  { value: "boarding", label: "Boarding" },
];
const expenseCategories = [
  "Salaries",
  "Utilities",
  "Maintenance",
  "Supplies",
  "Transport",
  "Food",
  "Sports",
  "Petty Cash",
  "General",
];

// ── helpers ──
const fmt = (n: unknown): string => {
  const v = Number(n);
  return `${new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number.isFinite(v) ? v : 0)}`;
};
const genInvoiceNum = () =>
  `INV-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")}`;
const genReceiptNum = () =>
  `RCPT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9999) + 1).padStart(4, "0")}`;

function statusBadge(status: string) {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-800 border-green-300",
    partial: "bg-amber-100 text-amber-800 border-amber-300",
    unpaid: "bg-red-100 text-red-800 border-red-300",
    overdue: "bg-red-200 text-red-900 border-red-400",
  };
  return (
    <Badge variant="outline" className={map[status] || ""}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export default function FinanceManagement() {
  const { toast } = useToast();
  const { user, role } = useAuth();
  const { rate, usdToZig } = useExchangeRate();
  const toNumber = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  };
  const convertUsdToZig = useCallback((usdValue: unknown) => Number(usdToZig(toNumber(usdValue)).toFixed(2)), [usdToZig]);
  const autoZig = useCallback(
    (usd: string) => {
      const n = Number(usd);
      return Number.isFinite(n) ? convertUsdToZig(n).toFixed(2) : "";
    },
    [convertUsdToZig],
  );
  const normalizeAmountRecord = useCallback(
    <T extends { amount_usd: number }>(row: T): T & { amount_zig: number } => ({
      ...row,
      amount_zig: convertUsdToZig(row.amount_usd),
    }),
    [convertUsdToZig],
  );
  const normalizeInvoiceRecord = useCallback(
    <T extends { total_usd: number; paid_usd: number }>(row: T): T => ({
      ...row,
      total_zig: convertUsdToZig(row.total_usd),
      paid_zig: convertUsdToZig(row.paid_usd),
    }),
    [convertUsdToZig],
  );
  const normalizeSupplierInvoiceRecord = useCallback(
    (row: SupplierInvoice): SupplierInvoice => ({
      ...row,
      amount_zig: convertUsdToZig(row.amount_usd),
      paid_zig: convertUsdToZig(row.paid_usd),
    }),
    [convertUsdToZig],
  );
  const isFinanceOrAdmin =
    role === "finance" || role === "finance_clerk" || role === "bursar" || role === "admin_supervisor" || role === "principal" || role === "deputy_principal";
  // Bursar is the finance supervisor - they can directly void/delete and
  // approve requests from Finance Clerks. Finance/Finance Clerk roles must
  // request approval from the Bursar before any destructive action.
  const isFinanceClerk = role === "finance" || role === "finance_clerk";

  // Helper: request supervisor approval instead of direct delete
  async function requestApproval(
    actionType: string,
    targetTable: string,
    targetId: string,
    description: string,
    metadata?: Json,
  ) {
    const { error } = await supabase.from("finance_approval_requests").insert({
      requested_by: user?.id,
      request_type: actionType,
      target_table: targetTable,
      target_id: targetId,
      description,
      metadata: metadata || {},
    });
    if (error) {
      toast({ title: "Error submitting request", description: error.message, variant: "destructive" });
      return false;
    }
    toast({
      title: "Approval requested",
      description: "Your request has been sent to the Bursar for review and approval.",
    });
    return true;
  }

  // ─── Fee Structures ───
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [feeDialogOpen, setFeeDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null);
  const [feeForm, setFeeForm] = useState({
    academic_year: "2026",
    term: "Term 1",
    form: DEFAULT_FORM,
    boarding_status: "day",
    description: "",
    amount_usd: "",
    amount_zig: "",
  });
  const [feeLoading, setFeeLoading] = useState(false);

  // ─── Delete Impact Modal ───
  const [deleteImpactOpen, setDeleteImpactOpen] = useState(false);
  const [deleteTargetFee, setDeleteTargetFee] = useState<FeeStructure | null>(null);
  const [deleteImpactCount, setDeleteImpactCount] = useState<number | null>(null);
  const [deleteImpactLoading, setDeleteImpactLoading] = useState(false);
  const [deleteConfirmLoading, setDeleteConfirmLoading] = useState(false);

  // ─── Invoices ───
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("all");
  const [invoiceTermFilter, setInvoiceTermFilter] = useState("all");
  const [invoiceDateFilter, setInvoiceDateFilter] = useState<FinanceDateFilter>(emptyDateFilter());
  const [paymentSearch, setPaymentSearch] = useState("");
  const [paymentDateFilter, setPaymentDateFilter] = useState<FinanceDateFilter>(emptyDateFilter());
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseDateFilter, setExpenseDateFilter] = useState<FinanceDateFilter>(emptyDateFilter());
  const [bulkInvoiceOpen, setBulkInvoiceOpen] = useState(false);
  const [bulkYear, setBulkYear] = useState("2026");
  const [bulkTerm, setBulkTerm] = useState("Term 1");
  const [bulkDueDate, setBulkDueDate] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);
  // Single invoice
  const [singleInvOpen, setSingleInvOpen] = useState(false);
  const [singleInvForm, setSingleInvForm] = useState({
    student_search: "",
    student_id: "",
    academic_year: "2026",
    term: "Term 1",
    due_date: "",
    description: "",
    amount_usd: "",
    amount_zig: "",
  });
  const [singleInvStudentResults, setSingleInvStudentResults] = useState<StudentHit[]>([]);
  const [singleInvSelectedStudent, setSingleInvSelectedStudent] = useState<StudentHit | null>(null);
  const [singleInvLoading, setSingleInvLoading] = useState(false);
  // NEW: for fee structure selection in single invoice
  const [availableFeeStructures, setAvailableFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedFeeStructure, setSelectedFeeStructure] = useState<FeeStructure | null>(null);

  // ─── Payments ───
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    student_search: "",
    invoice_id: "",
    amount_usd: "",
    amount_zig: "",
    payment_method: "cash" as PaymentMethod,
    reference_number: "",
    payment_date: new Date().toISOString().split("T")[0],
    notes: "",
  });
  const [studentResults, setStudentResults] = useState<StudentHit[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<StudentHit | null>(null);
  const [studentInvoices, setStudentInvoices] = useState<Invoice[]>([]);
  const [payLoading, setPayLoading] = useState(false);

  // ─── Printing / PDFs ───

  // ─── Expenses ───
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    expense_date: new Date().toISOString().split("T")[0],
    category: "General",
    description: "",
    amount_usd: "",
    amount_zig: "",
    payment_method: "cash",
    reference_number: "",
  });
  const [expLoading, setExpLoading] = useState(false);

  // ─── Debtors ───
  const [debtors, setDebtors] = useState<Invoice[]>([]);
  const [debtorsFormFilter, setDebtorsFormFilter] = useState("all");
  const [deleteDebtorOpen, setDeleteDebtorOpen] = useState(false);
  const [debtorToDelete, setDebtorToDelete] = useState<Invoice | null>(null);
  const [deletingDebtor, setDeletingDebtor] = useState(false);

  // ─── Petty Cash ───
  const [pettyCash, setPettyCash] = useState<PettyCash[]>([]);
  const [pcDialogOpen, setPcDialogOpen] = useState(false);
  const [pcForm, setPcForm] = useState({
    transaction_date: new Date().toISOString().split("T")[0],
    transaction_type: "withdrawal",
    description: "",
    amount_usd: "",
    amount_zig: "",
    reference_number: "",
  });
  const [pcLoading, setPcLoading] = useState(false);

  // ─── Supplier Invoices & Payments ───
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [siDialogOpen, setSiDialogOpen] = useState(false);
  const [siForm, setSiForm] = useState({
    supplier_name: "",
    supplier_contact: "",
    invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    due_date: "",
    description: "",
    amount_usd: "",
    amount_zig: "",
  });
  const [siLoading, setSiLoading] = useState(false);
  const [spDialogOpen, setSpDialogOpen] = useState(false);
  const [spInvoice, setSpInvoice] = useState<SupplierInvoice | null>(null);
  const [spForm, setSpForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount_usd: "",
    amount_zig: "",
    payment_method: "cash",
    reference_number: "",
    notes: "",
  });
  const [spLoading, setSpLoading] = useState(false);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);

  // ─── Cash on Delivery (COD) ───
  const [codDialogOpen, setCodDialogOpen] = useState(false);
  const [codForm, setCodForm] = useState({
    supplier_name: "",
    supplier_contact: "",
    description: "",
    amount_usd: "",
    amount_zig: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    reference_number: "",
    notes: "",
  });
  const [codLoading, setCodLoading] = useState(false);

  // ─── Student Statements ───
  const [stmtSearch, setStmtSearch] = useState("");
  const [stmtStudentResults, setStmtStudentResults] = useState<StudentHit[]>([]);
  const [stmtStudent, setStmtStudent] = useState<StudentHit | null>(null);
  const [stmtInvoices, setStmtInvoices] = useState<Invoice[]>([]);
  const [stmtPayments, setStmtPayments] = useState<Payment[]>([]);
  const [stmtLoading, setStmtLoading] = useState(false);

  // ─── Loading ───
  const [loading, setLoading] = useState(true);

  // ═══ FETCH FUNCTIONS ═══
  const fetchFeeStructures = useCallback(async () => {
    const { data } = await supabase.from("fee_structures").select("*").order("created_at", { ascending: false });
    if (data) setFeeStructures(data.map((fee) => ({ ...fee, amount_zig: convertUsdToZig(fee.amount_usd) })));
  }, [convertUsdToZig]);

  const fetchInvoices = useCallback(async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*, students(full_name, admission_number, form)")
      .order("created_at", { ascending: false });
    if (data) {
      const normalized = data.map(normalizeInvoiceRecord);
      setInvoices(normalized);
      // compute debtors
      const owing = normalized.filter((inv) => inv.status !== "paid");
      setDebtors(owing);
    }
  }, [normalizeInvoiceRecord]);

  const fetchPayments = useCallback(async () => {
    const { data } = await supabase
      .from("payments")
      .select("*, students(full_name, admission_number, form), invoices(invoice_number)")
      .order("created_at", { ascending: false });
    if (data) setPayments(data.map(normalizeAmountRecord));
  }, [normalizeAmountRecord]);

  const fetchExpenses = useCallback(async () => {
    const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    if (data) setExpenses(data.map(normalizeAmountRecord));
  }, [normalizeAmountRecord]);

  const fetchPettyCash = useCallback(async () => {
    const { data } = await supabase.from("petty_cash").select("*").order("transaction_date", { ascending: false });
    if (data) setPettyCash(data.map(normalizeAmountRecord));
  }, [normalizeAmountRecord]);

  const fetchSupplierInvoices = useCallback(async () => {
    const { data } = await supabase.from("supplier_invoices").select("*").order("created_at", { ascending: false });
    if (data) setSupplierInvoices(data.map(normalizeSupplierInvoiceRecord));
  }, [normalizeSupplierInvoiceRecord]);

  const fetchSupplierPayments = useCallback(async () => {
    const { data } = await supabase
      .from("supplier_payments")
      .select("*, supplier_invoices(supplier_name, invoice_number)")
      .order("payment_date", { ascending: false });
    if (data) setSupplierPayments(data.map(normalizeAmountRecord));
  }, [normalizeAmountRecord]);

  async function savePettyCash() {
    setPcLoading(true);
    const amountUsd = Number(pcForm.amount_usd) || 0;
    const payload = {
      transaction_date: pcForm.transaction_date,
      transaction_type: pcForm.transaction_type,
      description: pcForm.description,
      amount_usd: amountUsd,
      amount_zig: convertUsdToZig(amountUsd),
      reference_number: pcForm.reference_number || null,
      recorded_by: user?.id,
    };
    const { error } = await supabase.from("petty_cash").insert(payload);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setPcLoading(false);
      return;
    }
    toast({
      title: pcForm.transaction_type === "deposit" ? "Petty cash deposit recorded" : "Petty cash withdrawal recorded",
    });
    setPcDialogOpen(false);
    setPcLoading(false);
    fetchPettyCash();
  }

  async function deletePettyCash(id: string, description?: string) {
    if (isFinanceClerk) {
      await requestApproval("delete_petty_cash", "petty_cash", id, `Delete petty cash: ${description || id}`);
      return;
    }
    await supabase.from("petty_cash").delete().eq("id", id);
    toast({ title: "Petty cash entry deleted" });
    fetchPettyCash();
  }

  async function saveSupplierInvoice() {
    setSiLoading(true);
    const amountUsd = Number(siForm.amount_usd) || 0;
    const payload = {
      supplier_name: siForm.supplier_name,
      supplier_contact: siForm.supplier_contact || null,
      invoice_number: siForm.invoice_number,
      invoice_date: siForm.invoice_date,
      due_date: siForm.due_date || null,
      description: siForm.description || null,
      amount_usd: amountUsd,
      amount_zig: convertUsdToZig(amountUsd),
      recorded_by: user?.id,
    };
    const { error } = await supabase.from("supplier_invoices").insert(payload);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSiLoading(false);
      return;
    }
    toast({ title: "Supplier invoice recorded" });
    setSiDialogOpen(false);
    setSiLoading(false);
    fetchSupplierInvoices();
  }

  async function deleteSupplierInvoice(id: string, description?: string) {
    if (isFinanceClerk) {
      await requestApproval(
        "delete_supplier_invoice",
        "supplier_invoices",
        id,
        `Delete supplier invoice: ${description || id}`,
      );
      return;
    }
    await supabase.from("supplier_invoices").delete().eq("id", id);
    toast({ title: "Supplier invoice deleted" });
    fetchSupplierInvoices();
  }

  async function saveSupplierPayment() {
    if (!spInvoice) return;
    setSpLoading(true);
    const payUsd = Number(spForm.amount_usd) || 0;
    const payZig = convertUsdToZig(payUsd);
    const { error } = await supabase.from("supplier_payments").insert({
      supplier_invoice_id: spInvoice.id,
      payment_date: spForm.payment_date,
      amount_usd: payUsd,
      amount_zig: payZig,
      payment_method: spForm.payment_method,
      reference: spForm.reference_number || null,
      notes: spForm.notes || null,
      recorded_by: user?.id,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setSpLoading(false);
      return;
    }
    // Update supplier invoice paid amounts and status
    const newPaidUsd = Number(spInvoice.paid_usd) + payUsd;
    const newPaidZig = Number(spInvoice.paid_zig) + payZig;
    const newStatus = newPaidUsd >= Number(spInvoice.amount_usd) ? "paid" : newPaidUsd > 0 ? "partial" : "unpaid";
    await supabase
      .from("supplier_invoices")
      .update({ paid_usd: newPaidUsd, paid_zig: newPaidZig, status: newStatus })
      .eq("id", spInvoice.id);
    toast({ title: "Supplier payment recorded" });
    setSpDialogOpen(false);
    setSpLoading(false);
    fetchSupplierInvoices();
    fetchSupplierPayments();
  }

  async function saveCodPayment() {
    setCodLoading(true);
    // Create a supplier invoice marked as paid + a matching payment
    const invNumber = `COD-${Date.now()}`;
    const amtUsd = Number(codForm.amount_usd) || 0;
    const amtZig = convertUsdToZig(amtUsd);
    const { data: inv, error: invErr } = await supabase
      .from("supplier_invoices")
      .insert({
        supplier_name: codForm.supplier_name,
        supplier_contact: codForm.supplier_contact || null,
        invoice_number: invNumber,
        invoice_date: codForm.payment_date,
        description: codForm.description || "Cash on Delivery",
        amount_usd: amtUsd,
        amount_zig: amtZig,
        paid_usd: amtUsd,
        paid_zig: amtZig,
        status: "paid",
        recorded_by: user?.id,
      })
      .select()
      .single();
    if (invErr) {
      toast({ title: "Error", description: invErr.message, variant: "destructive" });
      setCodLoading(false);
      return;
    }
    await supabase.from("supplier_payments").insert({
      supplier_invoice_id: inv.id,
      payment_date: codForm.payment_date,
      amount_usd: amtUsd,
      amount_zig: amtZig,
      payment_method: codForm.payment_method,
      reference: codForm.reference_number || null,
      notes: codForm.notes || "Cash on Delivery",
      recorded_by: user?.id,
    });
    toast({ title: "Cash on delivery payment recorded" });
    setCodDialogOpen(false);
    setCodLoading(false);
    setCodForm({
      supplier_name: "",
      supplier_contact: "",
      description: "",
      amount_usd: "",
      amount_zig: "",
      payment_method: "cash",
      payment_date: new Date().toISOString().split("T")[0],
      reference_number: "",
      notes: "",
    });
    fetchSupplierInvoices();
    fetchSupplierPayments();
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchFeeStructures(),
      fetchInvoices(),
      fetchPayments(),
      fetchExpenses(),
      fetchPettyCash(),
      fetchSupplierInvoices(),
      fetchSupplierPayments(),
    ]).finally(() => setLoading(false));
  }, [fetchExpenses, fetchFeeStructures, fetchInvoices, fetchPayments, fetchPettyCash, fetchSupplierInvoices, fetchSupplierPayments, rate]);

  useEffect(() => {
    // Realtime subscription for ALL finance tables - keeps every finance user in sync
    const channel = supabase
      .channel(`finance-all-realtime-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => {
        fetchPayments();
        fetchInvoices();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        fetchInvoices();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
        fetchExpenses();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "fee_structures" }, () => {
        fetchFeeStructures();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoice_items" }, () => {
        fetchInvoices();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "online_payments" }, () => {
        fetchPayments();
        fetchInvoices();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "bank_transactions" }, () => {
        // Refresh relevant data when bank transactions change
        fetchPayments();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchExpenses, fetchFeeStructures, fetchInvoices, fetchPayments]);

  function openAddFee() {
    setEditingFee(null);
    setFeeForm({
      academic_year: "2026",
      term: "Term 1",
      form: DEFAULT_FORM,
      boarding_status: "day",
      description: "",
      amount_usd: "",
      amount_zig: "",
    });
    setFeeDialogOpen(true);
  }

  function openEditFee(fee: FeeStructure) {
    setEditingFee(fee);
    setFeeForm({
      academic_year: fee.academic_year,
      term: fee.term,
      form: fee.form,
      boarding_status: fee.boarding_status,
      description: fee.description || "",
      amount_usd: String(fee.amount_usd),
      amount_zig: convertUsdToZig(fee.amount_usd).toFixed(2),
    });
    setFeeDialogOpen(true);
  }

  async function duplicateFee(fee: FeeStructure) {
    const { error } = await supabase.from("fee_structures").insert({
      academic_year: fee.academic_year,
      term: fee.term,
      form: fee.form,
      boarding_status: fee.boarding_status,
      description: fee.description,
      amount_usd: fee.amount_usd,
      amount_zig: convertUsdToZig(fee.amount_usd),
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Fee structure duplicated" });
    fetchFeeStructures();
  }

  async function saveFee() {
    setFeeLoading(true);
    const amountUsd = Number(feeForm.amount_usd) || 0;
    const payload = {
      academic_year: feeForm.academic_year,
      term: feeForm.term,
      form: feeForm.form,
      boarding_status: feeForm.boarding_status,
      description: feeForm.description || null,
      amount_usd: amountUsd,
      amount_zig: convertUsdToZig(amountUsd),
    };
    if (editingFee) {
      const { error } = await supabase.from("fee_structures").update(payload).eq("id", editingFee.id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setFeeLoading(false);
        return;
      }
      toast({ title: "Fee structure updated" });
    } else {
      const { error } = await supabase.from("fee_structures").insert(payload);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        setFeeLoading(false);
        return;
      }
      toast({ title: "Fee structure created" });
    }
    setFeeDialogOpen(false);
    setFeeLoading(false);
    fetchFeeStructures();
  }

  async function openDeleteImpact(fee: FeeStructure) {
    setDeleteTargetFee(fee);
    setDeleteImpactCount(null);
    setDeleteImpactOpen(true);
    setDeleteImpactLoading(true);

    const { count, error } = await supabase
      .from("invoice_items")
      .select("id", { count: "exact", head: true })
      .eq("fee_structure_id", fee.id);

    setDeleteImpactCount(error ? -1 : (count ?? 0));
    setDeleteImpactLoading(false);
  }

  async function confirmDeleteFee() {
    if (!deleteTargetFee) return;

    if (isFinanceClerk) {
      const desc = `Delete fee structure: ${deleteTargetFee.form} ${deleteTargetFee.term} ${deleteTargetFee.academic_year} (${deleteTargetFee.boarding_status})`;
      await requestApproval("delete_fee_structure", "fee_structures", deleteTargetFee.id, desc);
      setDeleteImpactOpen(false);
      setDeleteTargetFee(null);
      return;
    }

    setDeleteConfirmLoading(true);
    const id = deleteTargetFee.id;

    const { error: unlinkError } = await supabase
      .from("invoice_items")
      .update({ fee_structure_id: null })
      .eq("fee_structure_id", id);

    if (unlinkError) {
      toast({ title: "Failed to delete fee structure", description: unlinkError.message, variant: "destructive" });
      setDeleteConfirmLoading(false);
      return;
    }

    const { data: deletedRows, error: deleteError } = await supabase
      .from("fee_structures")
      .delete()
      .eq("id", id)
      .select("id");

    if (deleteError) {
      toast({ title: "Failed to delete fee structure", description: deleteError.message, variant: "destructive" });
      setDeleteConfirmLoading(false);
      return;
    }

    if (!deletedRows || deletedRows.length === 0) {
      toast({
        title: "Fee structure was not deleted",
        description: "Permission or record mismatch issue.",
        variant: "destructive",
      });
      setDeleteConfirmLoading(false);
      return;
    }

    setFeeStructures((prev) => prev.filter((fee) => fee.id !== id));
    toast({ title: "Fee structure deleted" });
    setDeleteImpactOpen(false);
    setDeleteTargetFee(null);
    setDeleteConfirmLoading(false);
    fetchFeeStructures();
  }

  // ═══ STUDENT STATEMENTS ═══
  async function searchStmtStudents(query: string) {
    if (query.length < 2) {
      setStmtStudentResults([]);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("id, full_name, admission_number, form")
      .or(ilikeAny(["full_name", "admission_number"], query))
      .eq("status", "active")
      
      .limit(10);
    if (data) setStmtStudentResults(data);
  }

  async function selectStmtStudent(student: StudentHit) {
    setStmtStudent(student);
    setStmtStudentResults([]);
    setStmtSearch(student.full_name);
    setStmtLoading(true);
    const [invRes, payRes] = await Promise.all([
      supabase.from("invoices").select("*").eq("student_id", student.id).order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*, invoices(invoice_number)")
        .eq("student_id", student.id)
        .order("payment_date", { ascending: false }),
    ]);
    setStmtInvoices((invRes.data || []).map(normalizeInvoiceRecord));
    setStmtPayments((payRes.data || []).map(normalizeAmountRecord));
    setStmtLoading(false);
  }

  function clearStmtStudent() {
    setStmtStudent(null);
    setStmtSearch("");
    setStmtInvoices([]);
    setStmtPayments([]);
  }

  // Shared branded document shell for finance reports (statements, debtors, etc.)
  function buildReportShell(title: string, subtitleLines: string[], bodyHtml: string) {
    const body = `<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;color:#111;padding:32px;font-size:12px;background:#fff}
  .header{border-bottom:3px solid #6508c5;padding-bottom:12px;margin-bottom:18px}
  .header h1{margin:0;font-size:20px;color:#2d2d2d}
  .header .tag{color:#6508c5;font-weight:600;font-size:12px;letter-spacing:.5px;text-transform:uppercase}
  .header .addr{color:#555;font-size:11px;margin-top:4px}
  h2{font-size:14px;margin:22px 0 8px;color:#2d2d2d;border-bottom:1px solid #e2e8f0;padding-bottom:4px}
  .meta{color:#334155;font-size:12px;margin-bottom:6px}
  .meta strong{color:#2d2d2d}
  table{width:100%;border-collapse:collapse;margin-top:6px;font-size:11.5px}
  th,td{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}
  th{background:#6508c5;color:#fff;font-weight:600}
  tbody tr:nth-child(even){background:#f1f5f9}
  .right{text-align:right}
  .mono{font-family:'Courier New',monospace}
  .red{color:#b91c1c}
  .green{color:#047857}
  .total-row td{background:#fef3c7;font-weight:700;border-top:2px solid #92400e}
  .status-paid{color:#047857;font-weight:600}
  .status-partial{color:#b45309;font-weight:600}
  .status-unpaid,.status-overdue{color:#b91c1c;font-weight:600}
  .summary{margin-top:18px;padding:14px 18px;border:2px solid #2d2d2d;border-radius:6px;display:inline-block;background:#f8fafc}
  .summary p{margin:4px 0}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px;text-align:center}
  @media print{body{padding:18px}thead{display:table-header-group}tr{page-break-inside:avoid}}
</style>
  ${subtitleLines.map((l) => `<p class="meta">${l}</p>`).join("")}
  ${bodyHtml}
  <div class="footer">Confidential financial document</div>`;
    return buildBrandedHtml({ title, bodyHtml: body });
  }

  function statusText(status: string | null) {
    const clean = (status ?? "").replace(/[^a-zA-Z]/g, "").toLowerCase();
    const label = clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : "-";
    return `<span class="status-${clean}">${safeHtml(label)}</span>`;
  }

  function buildDebtorsReportHtml() {
    const filtered =
      debtorsFormFilter === "all" ? debtors : debtors.filter((d) => d.students?.form === debtorsFormFilter);
    const total = filtered.reduce((s, d) => s + (Number(d.total_usd) - Number(d.paid_usd)), 0);
    const rows = filtered.length
      ? filtered.map((d, i) => `<tr>
          <td>${i + 1}</td>
          <td>${safeHtml(d.students?.full_name || "-")}</td>
          <td>${safeHtml(d.students?.admission_number || "-")}</td>
          <td>${safeHtml(d.students?.form || "-")}</td>
          <td class="mono">${safeHtml(d.invoice_number)}</td>
          <td>${safeHtml(d.term)}</td>
          <td class="right mono red">${formatMoney(Number(d.total_usd) - Number(d.paid_usd))}</td>
          <td>${statusText(d.status)}</td>
        </tr>`).join("")
      : `<tr><td colspan="8" style="text-align:center;color:#64748b">No outstanding debts</td></tr>`;
    const body = `
      <table><thead><tr>
        <th>#</th><th>Student Name</th><th>Admission #</th><th>Form</th>
        <th>Invoice #</th><th>Term</th><th class="right">Amount Owed (US$)</th><th>Status</th>
      </tr></thead><tbody>
        ${rows}
        <tr class="total-row"><td colspan="6" class="right">TOTAL OUTSTANDING</td>
          <td class="right mono red">${formatMoney(total)}</td><td></td></tr>
      </tbody></table>`;
    return buildReportShell("Debtors List", [
      `<strong>Filter:</strong> ${debtorsFormFilter === "all" ? "All Forms" : safeHtml(debtorsFormFilter)}`,
      `<strong>Total students:</strong> ${filtered.length}`,
    ], body);
  }

  function printDebtorsList() {
    openPrintWindow(buildDebtorsReportHtml());
  }

  function downloadDebtorsList() {
    downloadHtmlDocument(buildDebtorsReportHtml(), `debtors-list-${new Date().toISOString().slice(0, 10)}`);
  }



  // ═══ INVOICE GENERATION (UPDATED) ═══
  async function generateBulkInvoices() {
    setBulkLoading(true);
    try {
      // Get active students (including boarding_status)
      const { data: students } = await supabase
        .from("students")
        .select("id, full_name, form, boarding_status, stream")
        .eq("status", "active")
        ;
      if (!students || students.length === 0) {
        toast({ title: "No active students found", variant: "destructive" });
        setBulkLoading(false);
        return;
      }

      // Get fee structures for this term/year (active only)
      const { data: feeStructures } = await supabase
        .from("fee_structures")
        .select("*")
        .eq("academic_year", bulkYear)
        .eq("term", bulkTerm)
        .eq("is_active", true);
      if (!feeStructures || feeStructures.length === 0) {
        toast({ title: "No fee structures found for this term", variant: "destructive" });
        setBulkLoading(false);
        return;
      }

      let created = 0;
      for (const student of students) {
        // Skip if invoice already exists for this student/term/year
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("student_id", student.id)
          .eq("academic_year", bulkYear)
          .eq("term", bulkTerm);
        if (existing && existing.length > 0) continue;

        // Find fee structures that apply to this student
        const applicableFees = feeStructures.filter((fs) => {
          if (fs.form && fs.form !== student.form) return false;
          if (fs.boarding_status && fs.boarding_status !== student.boarding_status) return false;
          return true;
        });
        if (applicableFees.length === 0) continue; // no fees for this student

        // Calculate totals
        const totalUsd = applicableFees.reduce((sum, fs) => sum + fs.amount_usd, 0);
        const totalZig = applicableFees.reduce((sum, fs) => sum + fs.amount_zig, 0);

        // Generate a simple invoice number (improve as needed)
        const invoiceNumber = `INV-${bulkYear.slice(-2)}-${bulkTerm.replace("Term ", "T")}-${String(created + 1).padStart(4, "0")}`;

        // Insert invoice header
        const { data: inv, error } = await supabase
          .from("invoices")
          .insert({
            invoice_number: invoiceNumber,
            student_id: student.id,
            academic_year: bulkYear,
            term: bulkTerm,
            total_usd: totalUsd,
            total_zig: totalZig,
            due_date: bulkDueDate || null,
            status: "unpaid",
            paid_usd: 0,
            paid_zig: 0,
          })
          .select()
          .single();

        if (error) {
          console.error("Invoice insert error:", error);
          continue;
        }

        // Insert invoice items (one per fee structure)
        for (const fs of applicableFees) {
          await supabase.from("invoice_items").insert({
            invoice_id: inv.id,
            fee_structure_id: fs.id,
            description:
              fs.description || `${fs.form} - ${fs.boarding_status === "boarding" ? "Boarding" : "Day"} Fees`,
            amount_usd: fs.amount_usd,
            amount_zig: fs.amount_zig,
          });
        }
        created++;
      }

      toast({ title: `${created} invoices generated` });
      setBulkInvoiceOpen(false);
      fetchInvoices();
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setBulkLoading(false);
  }

  // ═══ SINGLE STUDENT INVOICE (UPDATED) ═══
  async function searchSingleInvStudents(query: string) {
    if (query.length < 2) {
      setSingleInvStudentResults([]);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("id, full_name, admission_number, form, boarding_status")
      .or(ilikeAny(["full_name", "admission_number"], query))
      .eq("status", "active")
      
      .limit(10);
    if (data) setSingleInvStudentResults(data);
  }

  function selectSingleInvStudent(student: StudentHit) {
    setSingleInvSelectedStudent(student);
    setSingleInvStudentResults([]);
    setSingleInvForm((f) => ({ ...f, student_search: student.full_name, student_id: student.id }));
    // Fetch applicable fee structures for this student based on selected term/year
    fetchFeeStructuresForStudent(student);
  }

  async function fetchFeeStructuresForStudent(student: StudentHit | null) {
    if (!student) return;
    const { data: fs } = await supabase
      .from("fee_structures")
      .select("*")
      .eq("academic_year", singleInvForm.academic_year)
      .eq("term", singleInvForm.term)
      .eq("is_active", true);
    if (fs) {
      const applicable = fs
        .filter(
          (f) =>
            (!f.form || f.form === student.form) &&
            (!f.boarding_status || f.boarding_status === student.boarding_status),
        )
        .map((f) => ({ ...f, amount_zig: convertUsdToZig(f.amount_usd) }));
      setAvailableFeeStructures(applicable);
      if (applicable.length > 0) {
        setSelectedFeeStructure(applicable[0]);
        setSingleInvForm((f) => ({
          ...f,
          amount_usd: String(applicable[0].amount_usd),
          amount_zig: convertUsdToZig(applicable[0].amount_usd).toFixed(2),
          description: applicable[0].description || "",
        }));
      } else {
        setSelectedFeeStructure(null);
        setSingleInvForm((f) => ({ ...f, amount_usd: "", amount_zig: "", description: "" }));
      }
    }
  }

  async function createSingleInvoice() {
    if (!singleInvSelectedStudent) {
      toast({ title: "Select a student", variant: "destructive" });
      return;
    }
    const usd = Number(singleInvForm.amount_usd) || 0;
    const zig = convertUsdToZig(usd);
    if (usd === 0 && zig === 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }
    setSingleInvLoading(true);
    try {
      // Check if an invoice already exists for this student/term/year
      const { data: existingInv } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", singleInvSelectedStudent.id)
        .eq("academic_year", singleInvForm.academic_year)
        .eq("term", singleInvForm.term)
        .not("notes", "eq", "Auto-generated for advance payment")
        .maybeSingle();

      if (existingInv) {
        toast({ 
          title: "Invoice already exists", 
          description: `${existingInv.invoice_number} already exists for ${singleInvForm.term} ${singleInvForm.academic_year}. Payments should be recorded against it.`, 
          variant: "destructive" 
        });
        setSingleInvLoading(false);
        return;
      }

      const invoiceNumber = genInvoiceNum();
      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          invoice_number: invoiceNumber,
          student_id: singleInvSelectedStudent.id,
          academic_year: singleInvForm.academic_year,
          term: singleInvForm.term,
          total_usd: usd,
          total_zig: zig,
          due_date: singleInvForm.due_date || null,
          status: "unpaid",
          paid_usd: 0,
          paid_zig: 0,
        })
        .select()
        .single();
      if (error) throw error;

      // Insert invoice item(s) – if fee_structure_id is available, use it
      const feeStructureId = selectedFeeStructure?.id || null;
      await supabase.from("invoice_items").insert({
        invoice_id: inv.id,
        fee_structure_id: feeStructureId,
        description: singleInvForm.description || `${singleInvForm.term} ${singleInvForm.academic_year} Fees`,
        amount_usd: usd,
        amount_zig: zig,
      });

      toast({
        title: "Invoice created",
        description: `Invoice ${invoiceNumber} created for ${singleInvSelectedStudent.full_name}`,
      });
      downloadInvoicePdf(inv, singleInvSelectedStudent, [
        {
          description: singleInvForm.description || `${singleInvForm.term} ${singleInvForm.academic_year} Fees`,
          amount_usd: usd,
          amount_zig: zig,
        },
      ]);
      setSingleInvOpen(false);
      setSingleInvSelectedStudent(null);
      setSingleInvForm({
        student_search: "",
        student_id: "",
        academic_year: "2026",
        term: "Term 1",
        due_date: "",
        description: "",
        amount_usd: "",
        amount_zig: "",
      });
      fetchInvoices();
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setSingleInvLoading(false);
  }

  async function downloadInvoicePdf(inv: Invoice, student?: StudentRef, items?: (Pick<InvoiceItem, "description" | "amount_usd"> & { amount_zig?: number })[]) {
    try {
      let logoDataUrl: string | undefined;
      try {
        logoDataUrl = await urlToDataUrl(SCHOOL_LOGO_URL);
      } catch {
        // Logo is optional; the PDF is still generated without it.
      }
      let invoiceItems = items;
      if (!invoiceItems) {
        const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
        invoiceItems = data || [];
      }
      const doc = buildInvoicePdf({
        logoDataUrl,
        invoiceNumber: inv.invoice_number,
        academicYear: inv.academic_year,
        term: inv.term,
        dueDate: inv.due_date,
        student: {
          fullName: student?.full_name || inv.students?.full_name || "-",
          admissionNumber: student?.admission_number || inv.students?.admission_number || "-",
          form: student?.form || inv.students?.form,
        },
        items: invoiceItems.map((it) => ({
          description: it.description,
          amount_usd: it.amount_usd,
          amount_zig: convertUsdToZig(it.amount_usd),
        })),
        totals: { total_usd: inv.total_usd, total_zig: inv.total_zig, paid_usd: inv.paid_usd, paid_zig: inv.paid_zig },
      });
      doc.save(`${inv.invoice_number}.pdf`);
    } catch (err) {
      toast({ title: "Error generating PDF", description: errorMessage(err), variant: "destructive" });
    }
  }

  // ═══ PAYMENT PROCESSING ═══
  async function searchStudents(query: string) {
    if (query.length < 2) {
      setStudentResults([]);
      return;
    }
    const { data } = await supabase
      .from("students")
      .select("id, full_name, admission_number, form")
      .or(ilikeAny(["full_name", "admission_number"], query))
      .eq("status", "active")
      
      .limit(10);
    if (data) setStudentResults(data);
  }

  async function selectStudentForPayment(student: StudentHit) {
    setSelectedStudent(student);
    setStudentResults([]);
    setPayForm((p) => ({ ...p, student_search: student.full_name }));
    // Fetch ALL invoices for this student so we can always pay against existing ones
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false });
    if (data) {
      const normalized = data.map(normalizeInvoiceRecord);
      // Prefer unpaid/partial invoices first, but show all
      const sorted = [...normalized].sort((a, b) => {
        const order = { unpaid: 0, partial: 1, paid: 2 };
        return (order[a.status] ?? 2) - (order[b.status] ?? 2);
      });
      setStudentInvoices(sorted);
      // Auto-select the first unpaid/partial invoice
      const firstUnpaid = sorted.find((i) => i.status === "unpaid" || i.status === "partial");
      if (firstUnpaid) {
        setPayForm((p) => ({ ...p, student_search: student.full_name, invoice_id: firstUnpaid.id }));
      } else if (sorted.length === 1) {
        setPayForm((p) => ({ ...p, student_search: student.full_name, invoice_id: sorted[0].id }));
      }
    }
  }

  async function recordPayment() {
    if (!selectedStudent) {
      toast({ title: "Please select a student", variant: "destructive" });
      return;
    }
    if (!payForm.invoice_id && studentInvoices.length > 0) {
      toast({ title: "Please select an invoice", variant: "destructive" });
      return;
    }
    const usd = Number(payForm.amount_usd) || 0;
    const zig = convertUsdToZig(usd);
    if (usd === 0 && zig === 0) {
      toast({ title: "Enter an amount", variant: "destructive" });
      return;
    }

    setPayLoading(true);
    try {
      const receiptNumber = genReceiptNum();
      let invoiceId = payForm.invoice_id || null;
      let invoiceNumber: string | null = null;

      // If no invoice selected, find the existing term invoice for this student
      if (!invoiceId) {
        const now = new Date();
        const currentYear = now.getFullYear().toString();
        const month = now.getMonth() + 1;
        const currentTerm = month <= 4 ? "Term 1" : month <= 8 ? "Term 2" : "Term 3";

        const { data: existingInvs } = await supabase
          .from("invoices")
          .select("*")
          .eq("student_id", selectedStudent.id)
          .order("created_at", { ascending: false });

        if (existingInvs && existingInvs.length > 0) {
          // Priority: 1) Current term fee invoice (unpaid/partial), 2) Any unpaid/partial, 3) Current term any, 4) Most recent non-advance
          const preferredInvoice =
            existingInvs.find((inv) =>
              String(inv.academic_year) === currentYear &&
              inv.term === currentTerm &&
              (inv.status === "unpaid" || inv.status === "partial") &&
              inv.notes !== "Auto-generated for advance payment"
            ) ||
            existingInvs.find((inv) => inv.status === "unpaid" || inv.status === "partial") ||
            existingInvs.find((inv) =>
              String(inv.academic_year) === currentYear &&
              inv.term === currentTerm
            ) ||
            existingInvs.find((inv) => inv.notes !== "Auto-generated for advance payment") ||
            existingInvs[0];

          invoiceId = preferredInvoice.id;
          invoiceNumber = preferredInvoice.invoice_number;
        }

        // If truly no invoice exists at all, show error - student should be term-registered first
        if (!invoiceId) {
          toast({
            title: "No invoice found",
            description: "Please register the student for the current term first (Student Management → Term Registration). This will create the invoice automatically.",
            variant: "destructive",
          });
          setPayLoading(false);
          return;
        }
      }

      const { error } = await supabase.from("payments").insert({
        receipt_number: receiptNumber,
        invoice_id: invoiceId,
        student_id: selectedStudent.id,
        amount: usd,
        amount_usd: usd,
        amount_zig: zig,
        payment_method: payForm.payment_method,
        reference_number: payForm.reference_number || null,
        payment_date: payForm.payment_date,
        recorded_by: user?.id || null,
        notes: payForm.notes || null,
      });
      if (error) throw error;

      if (!invoiceNumber && invoiceId) {
        const matchedInvoice = studentInvoices.find((inv) => inv.id === invoiceId);
        invoiceNumber = matchedInvoice?.invoice_number || null;
      }

      toast({ title: "Payment recorded", description: `Receipt: ${receiptNumber}` });

      // Auto-generate receipt for printing
      const receiptHtml = buildReceiptHtml({
        logoUrl: SCHOOL_LOGO_URL,
        receiptNumber,
        paymentDate: payForm.payment_date,
        student: {
          fullName: selectedStudent.full_name,
          admissionNumber: selectedStudent.admission_number,
          form: selectedStudent.form,
        },
        invoiceNumber,
        amounts: { usd, zig },
        paymentMethod: payForm.payment_method,
        referenceNumber: payForm.reference_number,
      });
      const w = window.open("", "_blank");
      if (w) {
        w.document.open();
        w.document.write(receiptHtml);
        w.document.close();
        w.focus();
        setTimeout(() => w.print(), 300);
      }

      setPayDialogOpen(false);
      setSelectedStudent(null);
      setStudentInvoices([]);
      setPayForm({
        student_search: "",
        invoice_id: "",
        amount_usd: "",
        amount_zig: "",
        payment_method: "cash",
        reference_number: "",
        payment_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      fetchInvoices();
      fetchPayments();
      if (stmtStudent) selectStmtStudent(stmtStudent);
    } catch (err) {
      toast({ title: "Error", description: errorMessage(err), variant: "destructive" });
    }
    setPayLoading(false);
  }

  // ═══ EXPENSE RECORDING ═══
  async function saveExpense() {
    if (!expForm.description) {
      toast({ title: "Description required", variant: "destructive" });
      return;
    }
    setExpLoading(true);
    const amountUsd = Number(expForm.amount_usd) || 0;
    const { error } = await supabase.from("expenses").insert({
      expense_date: expForm.expense_date,
      category: expForm.category,
      description: expForm.description,
      amount_usd: amountUsd,
      amount_zig: convertUsdToZig(amountUsd),
      payment_method: expForm.payment_method,
      reference_number: expForm.reference_number || null,
      recorded_by: user?.id || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      setExpLoading(false);
      return;
    }
    toast({ title: "Expense recorded" });
    setExpDialogOpen(false);
    setExpForm({
      expense_date: new Date().toISOString().split("T")[0],
      category: "General",
      description: "",
      amount_usd: "",
      amount_zig: "",
      payment_method: "cash",
      reference_number: "",
    });
    setExpLoading(false);
    fetchExpenses();
  }

  async function deleteExpense(id: string, description?: string) {
    if (isFinanceClerk) {
      await requestApproval("delete_expense", "expenses", id, `Delete expense: ${description || id}`);
      return;
    }
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    toast({ title: "Expense deleted" });
    fetchExpenses();
  }

  async function deletePayment(payment: Payment) {
    if (isFinanceClerk) {
      await requestApproval(
        "void_payment",
        "payments",
        payment.id,
        `Void payment ${payment.receipt_number} (${formatMoney(payment.amount_usd)})`,
        {
          invoice_id: payment.invoice_id,
          amount_usd: payment.amount_usd,
          amount_zig: payment.amount_zig,
        },
      );
      return;
    }
    if (!confirm(`Delete payment ${payment.receipt_number}? This will reverse the paid amounts on the linked invoice.`))
      return;
    try {
      await supabase.from("audit_logs").insert({
        action: "delete_payment",
        table_name: "payments",
        record_id: payment.id,
        user_id: user?.id || null,
        old_data: payment,
      });
      const { error } = await supabase.from("payments").delete().eq("id", payment.id);
      if (error) throw error;
      toast({
        title: "Payment deleted",
        description: `Receipt ${payment.receipt_number} removed and invoice updated.`,
      });
      fetchPayments();
      fetchInvoices();
      if (stmtStudent) selectStmtStudent(stmtStudent);
    } catch (err) {
      toast({ title: "Error deleting payment", description: errorMessage(err), variant: "destructive" });
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    if (isFinanceClerk) {
      await requestApproval(
        "void_invoice",
        "invoices",
        invoice.id,
        `Void invoice ${invoice.invoice_number} (${formatMoney(invoice.total_usd)})`,
      );
      return;
    }
    if (
      !confirm(
        `Delete invoice ${invoice.invoice_number}? This will also delete all associated payments and invoice items.`,
      )
    )
      return;
    try {
      await supabase.from("payments").delete().eq("invoice_id", invoice.id);
      await supabase.from("invoice_items").delete().eq("invoice_id", invoice.id);
      await supabase.from("audit_logs").insert({
        action: "delete_invoice",
        table_name: "invoices",
        record_id: invoice.id,
        user_id: user?.id || null,
        old_data: invoice,
      });
      const { error } = await supabase.from("invoices").delete().eq("id", invoice.id);
      if (error) throw error;
      toast({ title: "Invoice deleted", description: `${invoice.invoice_number} and associated records removed.` });
      fetchInvoices();
      fetchPayments();
      if (stmtStudent) selectStmtStudent(stmtStudent);
    } catch (err) {
      toast({ title: "Error deleting invoice", description: errorMessage(err), variant: "destructive" });
    }
  }

  // ═══ COMPUTED ═══
  const filteredInvoices = invoices.filter((inv) => {
    if (invoiceStatusFilter !== "all" && inv.status !== invoiceStatusFilter) return false;
    if (invoiceTermFilter !== "all" && inv.term !== invoiceTermFilter) return false;
    if (!dateMatches(invoiceDateFilter, inv.created_at || inv.due_date)) return false;
    if (invoiceSearch) {
      const s = invoiceSearch.toLowerCase();
      const name = inv.students?.full_name?.toLowerCase() || "";
      const num = inv.invoice_number?.toLowerCase() || "";
      const adm = inv.students?.admission_number?.toLowerCase() || "";
      if (!name.includes(s) && !num.includes(s) && !adm.includes(s)) return false;
    }
    return true;
  });

  const filteredPayments = payments.filter((p) => {
    if (!dateMatches(paymentDateFilter, p.payment_date)) return false;
    if (paymentSearch) {
      const s = paymentSearch.toLowerCase();
      const hay = `${p.receipt_number || ""} ${p.students?.full_name || ""} ${p.invoices?.invoice_number || ""} ${p.payment_method || ""} ${p.reference_number || ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const filteredExpenses = expenses.filter((e) => {
    if (!dateMatches(expenseDateFilter, e.expense_date)) return false;
    if (expenseSearch) {
      const s = expenseSearch.toLowerCase();
      const hay = `${e.description || ""} ${e.category || ""} ${e.payment_method || ""} ${e.reference_number || ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const totalOwedUsd = debtors.reduce((s, d) => s + (Number(d.total_usd) - Number(d.paid_usd)), 0);
  const totalOwedZig = debtors.reduce((s, d) => s + (Number(d.total_zig) - Number(d.paid_zig)), 0);
  const totalCollectedUsd = payments.reduce((s, p) => s + Number(p.amount_usd), 0);
  const totalCollectedZig = payments.reduce((s, p) => s + Number(p.amount_zig), 0);
  const totalExpensesUsd = expenses.reduce((s, e) => s + Number(e.amount_usd), 0);
  const totalExpensesZig = expenses.reduce((s, e) => s + Number(e.amount_zig), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards (unchanged) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Total Collected",
            usd: totalCollectedUsd,
            zig: totalCollectedZig,
            icon: DollarSign,
            color: "text-green-600",
          },
          { label: "Outstanding", usd: totalOwedUsd, zig: totalOwedZig, icon: AlertTriangle, color: "text-red-600" },
          {
            label: "Expenses",
            usd: totalExpensesUsd,
            zig: totalExpensesZig,
            icon: TrendingUp,
            color: "text-amber-600",
          },
          {
            label: "Net Income",
            usd: totalCollectedUsd - totalExpensesUsd,
            zig: totalCollectedZig - totalExpensesZig,
            icon: BarChart3,
            color: "text-accent",
          },
        ].map((c, i) => (
          <Card key={i} className="border-none shadow-maroon">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <c.icon className={`h-5 w-5 ${c.color}`} />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{c.label}</span>
              </div>
              <p className="text-lg font-bold">US$ {fmt(c.usd)}</p>
              <p className="text-xs font-mono text-muted-foreground">ZiG {fmt(c.zig)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ExchangeRateCard />




      <Tabs defaultValue="fee-structures" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="fee-structures">
            <DollarSign className="mr-1 h-4 w-4" /> Fee Structures
          </TabsTrigger>
          <TabsTrigger value="invoices">
            <FileText className="mr-1 h-4 w-4" /> Invoices
          </TabsTrigger>
          <TabsTrigger value="payments">
            <CreditCard className="mr-1 h-4 w-4" /> Payments
          </TabsTrigger>
          <TabsTrigger value="receipts">
            <Receipt className="mr-1 h-4 w-4" /> Receipts
          </TabsTrigger>
          <TabsTrigger value="debtors">
            <AlertTriangle className="mr-1 h-4 w-4" /> Debtors
          </TabsTrigger>
          <TabsTrigger value="petty-cash">
            <DollarSign className="mr-1 h-4 w-4" /> Petty Cash
          </TabsTrigger>
          <TabsTrigger value="supplier-payables">
            <Ban className="mr-1 h-4 w-4" /> Supplier Payables
          </TabsTrigger>
          <TabsTrigger value="statements">
            <User className="mr-1 h-4 w-4" /> Statements
          </TabsTrigger>
          <TabsTrigger value="expenses">
            <Receipt className="mr-1 h-4 w-4" /> Expenses
          </TabsTrigger>
          <TabsTrigger value="bank-recon">
            <CheckCircle className="mr-1 h-4 w-4" /> Bank Reconciliation
          </TabsTrigger>
          <TabsTrigger value="income-expenditure">
            <TrendingDown className="mr-1 h-4 w-4" /> Income & Expenditure
          </TabsTrigger>
          <TabsTrigger value="reports">
            <BarChart3 className="mr-1 h-4 w-4" /> Reports
          </TabsTrigger>
        </TabsList>

        {/* Fee Structures Tab – unchanged */}
        <TabsContent value="fee-structures">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading">Fee Structures</CardTitle>
                <CardDescription>Define fees per grade and term</CardDescription>
              </div>
              <Button onClick={openAddFee} className="bg-accent hover:bg-accent/90 text-accent-foreground">
                <Plus className="mr-1 h-4 w-4" /> Add Fee
              </Button>
            </CardHeader>
            <CardContent>
              {feeStructures.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  No fee structures yet. Click "Add Fee" to create one.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Year</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Form</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feeStructures.map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell>{fee.academic_year}</TableCell>
                          <TableCell>{fee.term}</TableCell>
                          <TableCell>{fee.form}</TableCell>
                          <TableCell>{fee.boarding_status === "boarding" ? "Boarding" : "Day"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">{fee.description || "-"}</TableCell>
                          <TableCell className="text-right font-mono">{formatMoney(fee.amount_usd)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditFee(fee)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => duplicateFee(fee)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteImpact(fee)}>
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
        </TabsContent>

        {/* Invoices Tab – updated with positive credit display */}
        <TabsContent value="invoices">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="font-heading">Invoices</CardTitle>
                <CardDescription>{invoices.length} total invoices</CardDescription>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSingleInvOpen(true);
                    setSingleInvSelectedStudent(null);
                    setSingleInvForm({
                      student_search: "",
                      student_id: "",
                      academic_year: "2026",
                      term: "Term 1",
                      due_date: "",
                      description: "",
                      amount_usd: "",
                      amount_zig: "",
                    });
                  }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Create Invoice
                </Button>
                <Button
                  onClick={() => setBulkInvoiceOpen(true)}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Plus className="mr-1 h-4 w-4" /> Bulk Generate
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, admission # or invoice #"
                    className="pl-9"
                    value={invoiceSearch}
                    onChange={(e) => setInvoiceSearch(e.target.value)}
                  />
                </div>
                <Select value={invoiceStatusFilter} onValueChange={setInvoiceStatusFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={invoiceTermFilter} onValueChange={setInvoiceTermFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Terms</SelectItem>
                    {termOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DateRangeFilter value={invoiceDateFilter} onChange={setInvoiceDateFilter} />


              {filteredInvoices.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No invoices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Form</TableHead>
                        <TableHead>Term</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Total (US$)</TableHead>
                        <TableHead className="text-right">Paid (US$)</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Balance Due</TableHead>
                        {isFinanceOrAdmin && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((inv) => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-mono text-xs">{inv.invoice_number}</TableCell>
                          <TableCell>{inv.students?.full_name || "-"}</TableCell>
                          <TableCell>{inv.students?.form || "-"}</TableCell>
                          <TableCell>{inv.term}</TableCell>
                          <TableCell className="text-xs">
                            {inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "Not set"}
                          </TableCell>
                          <TableCell className="text-right font-mono">{fmt(inv.total_usd)}</TableCell>
                          <TableCell className="text-right font-mono">{fmt(inv.paid_usd)}</TableCell>
                          <TableCell>{statusBadge(inv.status)}</TableCell>
                          <TableCell className="text-right font-mono">
                            {(() => {
                              const balance = inv.total_usd - inv.paid_usd;
                              if (balance < 0) {
                                return <span className="text-green-600">({fmt(Math.abs(balance))} credit)</span>;
                              }
                              return fmt(balance);
                            })()}
                          </TableCell>
                          {isFinanceOrAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <DocActionButtons
                                  actions={() => invoiceActions(inv, {
                                    fullName: inv.students?.full_name || "-",
                                    admissionNumber: inv.students?.admission_number || "",
                                    form: inv.students?.form,
                                  })}
                                  email={{
                                    documentLabel: "invoice",
                                    filename: `invoice-${inv.invoice_number}`,
                                    subject: `Invoice ${inv.invoice_number} | Concepts Learning Academy`,
                                  }}
                                />
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteInvoice(inv)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payments Tab – fully restored */}
        <TabsContent value="payments">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading">Payments</CardTitle>
                <CardDescription>{payments.length} payments recorded</CardDescription>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                    <Plus className="mr-1 h-4 w-4" /> Record Payment <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setPayDialogOpen(true);
                      setSelectedStudent(null);
                      setStudentInvoices([]);
                      setPayForm({
                        student_search: "",
                        invoice_id: "",
                        amount_usd: "",
                        amount_zig: "",
                        payment_method: "cash",
                        reference_number: "",
                        payment_date: new Date().toISOString().split("T")[0],
                        notes: "",
                      });
                    }}
                  >
                    <User className="mr-2 h-4 w-4" /> Student Fee Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setSpInvoice(null);
                      setSpDialogOpen(true);
                      setSpForm({
                        payment_date: new Date().toISOString().split("T")[0],
                        amount_usd: "",
                        amount_zig: "",
                        payment_method: "cash",
                        reference_number: "",
                        notes: "",
                      });
                    }}
                  >
                    <FileText className="mr-2 h-4 w-4" /> Supplier Invoice Payment
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setCodDialogOpen(true);
                      setCodForm({
                        supplier_name: "",
                        supplier_contact: "",
                        description: "",
                        amount_usd: "",
                        amount_zig: "",
                        payment_method: "cash",
                        payment_date: new Date().toISOString().split("T")[0],
                        reference_number: "",
                        notes: "",
                      });
                    }}
                  >
                    <Truck className="mr-2 h-4 w-4" /> Cash on Delivery (COD)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search by receipt #, student, invoice…" className="pl-9" value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} />
                </div>
                <DateRangeFilter value={paymentDateFilter} onChange={setPaymentDateFilter} />
              </div>
              {filteredPayments.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No payments match the filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Receipt #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Ref</TableHead>
                        {isFinanceOrAdmin && <TableHead>Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((pay) => (
                        <TableRow key={pay.id}>
                          <TableCell className="font-mono text-xs">{pay.receipt_number}</TableCell>
                          <TableCell>{pay.payment_date}</TableCell>
                          <TableCell>{pay.students?.full_name || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{pay.invoices?.invoice_number || "-"}</TableCell>
                          <TableCell className="text-right font-mono">{formatMoney(pay.amount_usd)}</TableCell>
                          <TableCell>{paymentMethodLabel(pay.payment_method)}</TableCell>
                          <TableCell className="text-xs">{pay.reference_number || "-"}</TableCell>
                          {isFinanceOrAdmin && (
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <DocActionButtons
                                  actions={receiptActions(pay, {
                                    fullName: pay.students?.full_name || "-",
                                    admissionNumber: pay.students?.admission_number || "",
                                    form: pay.students?.form,
                                  })}
                                  email={{
                                    documentLabel: "receipt",
                                    filename: `receipt-${pay.receipt_number}`,
                                    subject: `Official Receipt ${pay.receipt_number} | Concepts Learning Academy`,
                                  }}
                                />
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deletePayment(pay)} title="Delete">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Receipts Tab – unchanged (uses ReceiptSearchTab) */}
        <TabsContent value="receipts">
          <ReceiptSearchTab />
        </TabsContent>

        {/* Debtors Tab – unchanged */}
        <TabsContent value="debtors">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-5">
                  <p className="text-xs text-destructive font-medium uppercase tracking-wider">Total Outstanding</p>
                  <p className="text-xl font-bold text-destructive">{fmt(totalOwedUsd)}</p>
                  <p className="text-sm text-destructive/80">ZiG {fmt(totalOwedZig)}</p>
                </CardContent>
              </Card>
              <Card className="border-amber-300/50 bg-amber-50/50">
                <CardContent className="p-5">
                  <p className="text-xs text-amber-700 font-medium uppercase tracking-wider">Partial Payments</p>
                  <p className="text-xl font-bold text-amber-800">
                    {debtors.filter((d) => d.status === "partial").length}
                  </p>
                  <p className="text-sm text-amber-600">students</p>
                </CardContent>
              </Card>
              <Card className="border-destructive/40 bg-destructive/10">
                <CardContent className="p-5">
                  <p className="text-xs text-destructive font-medium uppercase tracking-wider">Unpaid</p>
                  <p className="text-xl font-bold text-destructive">
                    {debtors.filter((d) => d.status === "unpaid").length}
                  </p>
                  <p className="text-sm text-destructive/80">students</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                <CardTitle className="font-heading">Debtors List</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Select value={debtorsFormFilter} onValueChange={setDebtorsFormFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Filter by Form" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Forms</SelectItem>
                      {FORM_LEVELS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={printDebtorsList} disabled={debtors.length === 0}>
                    <Printer className="mr-1 h-4 w-4" /> Print List
                  </Button>
                  <Button variant="outline" onClick={downloadDebtorsList} disabled={debtors.length === 0}>
                    <Download className="mr-1 h-4 w-4" /> Download PDF
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {(() => {
                  const filtered =
                    debtorsFormFilter === "all"
                      ? debtors
                      : debtors.filter((d) => d.students?.form === debtorsFormFilter);
                  return filtered.length === 0 ? (
                    <p className="text-center py-8 text-muted-foreground">
                      No outstanding debts{debtorsFormFilter !== "all" ? ` for ${debtorsFormFilter}` : ""}. 🎉
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Student</TableHead>
                            <TableHead>Adm #</TableHead>
                            <TableHead>Form</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead>Term</TableHead>
                            <TableHead className="text-right">Owed (US$)</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((d, idx) => (
                            <TableRow key={d.id}>
                              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                              <TableCell>{d.students?.full_name || "-"}</TableCell>
                              <TableCell>{d.students?.admission_number || "-"}</TableCell>
                              <TableCell>{d.students?.form || "-"}</TableCell>
                              <TableCell className="font-mono text-xs">{d.invoice_number}</TableCell>
                              <TableCell>{d.term}</TableCell>
                              <TableCell className="text-right font-mono text-destructive">
                                {fmt(Number(d.total_usd) - Number(d.paid_usd))}
                              </TableCell>
                              <TableCell>{statusBadge(d.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setDebtorToDelete(d);
                                    setDeleteDebtorOpen(true);
                                  }}
                                  title="Remove debtor"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Petty Cash Tab – unchanged */}
        <TabsContent value="petty-cash">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="font-heading">Petty Cash</CardTitle>
                <CardDescription>Track deposits into and withdrawals from the petty cash float</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setPcForm({
                      transaction_date: new Date().toISOString().split("T")[0],
                      transaction_type: "deposit",
                      description: "",
                      amount_usd: "",
                      amount_zig: "",
                      reference_number: "",
                    });
                    setPcDialogOpen(true);
                  }}
                >
                  <TrendingUp className="mr-1 h-4 w-4" /> Deposit
                </Button>
                <Button
                  onClick={() => {
                    setPcForm({
                      transaction_date: new Date().toISOString().split("T")[0],
                      transaction_type: "withdrawal",
                      description: "",
                      amount_usd: "",
                      amount_zig: "",
                      reference_number: "",
                    });
                    setPcDialogOpen(true);
                  }}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Plus className="mr-1 h-4 w-4" /> Withdrawal
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(() => {
                const depositsUsd = pettyCash
                  .filter((t) => t.transaction_type === "deposit")
                  .reduce((s, t) => s + Number(t.amount_usd), 0);
                const depositsZig = pettyCash
                  .filter((t) => t.transaction_type === "deposit")
                  .reduce((s, t) => s + Number(t.amount_zig), 0);
                const withdrawalsUsd = pettyCash
                  .filter((t) => t.transaction_type === "withdrawal")
                  .reduce((s, t) => s + Number(t.amount_usd), 0);
                const withdrawalsZig = pettyCash
                  .filter((t) => t.transaction_type === "withdrawal")
                  .reduce((s, t) => s + Number(t.amount_zig), 0);
                const balUsd = depositsUsd - withdrawalsUsd;
                const balZig = depositsZig - withdrawalsZig;
                return (
                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Deposits</p>
                        <p className="text-xl font-bold font-mono text-green-700">{fmt(depositsUsd)}</p>
                        <p className="text-sm font-mono text-muted-foreground">ZiG {fmt(depositsZig)}</p>
                      </div>
                      <div className="rounded-lg border p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Withdrawals</p>
                        <p className="text-xl font-bold font-mono text-destructive">{fmt(withdrawalsUsd)}</p>
                        <p className="text-sm font-mono text-muted-foreground">ZiG {fmt(withdrawalsZig)}</p>
                      </div>
                      <div
                        className={`rounded-lg border p-4 ${balUsd >= 0 ? "bg-green-50/50 border-green-200" : "bg-destructive/5 border-destructive/30"}`}
                      >
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Float Balance</p>
                        <p
                          className={`text-xl font-bold font-mono ${balUsd >= 0 ? "text-green-700" : "text-destructive"}`}
                        >
                           US$ {fmt(balUsd)}
                        </p>
                        <p className="text-sm font-mono text-muted-foreground">ZiG {fmt(balZig)}</p>
                      </div>
                    </div>
                    {pettyCash.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No petty cash transactions recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {pettyCash.map((pc) => (
                              <TableRow key={pc.id}>
                                <TableCell className="text-xs">{pc.transaction_date}</TableCell>
                                <TableCell>
                                  <Badge
                                    variant="outline"
                                    className={
                                      pc.transaction_type === "deposit"
                                        ? "bg-green-100 text-green-800 border-green-300"
                                        : "bg-red-100 text-red-800 border-red-300"
                                    }
                                  >
                                    {pc.transaction_type === "deposit" ? "Deposit" : "Withdrawal"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="max-w-[250px] truncate">{pc.description}</TableCell>
                                <TableCell
                                  className={`text-right font-mono ${pc.transaction_type === "deposit" ? "text-green-700" : "text-destructive"}`}
                                >
                                  {pc.transaction_type === "deposit" ? "+" : "-"}
                                  {formatMoney(pc.amount_usd)}
                                </TableCell>
                                <TableCell className="text-xs">{pc.reference_number || "-"}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => deletePettyCash(pc.id)}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Supplier Payables Tab – unchanged */}
        <TabsContent value="supplier-payables">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-5">
                  <p className="text-xs text-destructive font-medium uppercase tracking-wider">
                    Total Owed to Suppliers
                  </p>
                  <p className="text-xl font-bold text-destructive">
                     US$ {fmt(supplierInvoices.reduce((s, si) => s + (Number(si.amount_usd) - Number(si.paid_usd)), 0))}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Invoices</p>
                  <p className="text-xl font-bold">{supplierInvoices.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Unpaid Invoices</p>
                  <p className="text-xl font-bold text-destructive">
                    {supplierInvoices.filter((si) => si.status !== "paid").length}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                <CardTitle className="font-heading">Supplier Invoices</CardTitle>
                <Button
                  onClick={() => {
                    setSiDialogOpen(true);
                    setSiForm({
                      supplier_name: "",
                      supplier_contact: "",
                      invoice_number: "",
                      invoice_date: new Date().toISOString().split("T")[0],
                      due_date: "",
                      description: "",
                      amount_usd: "",
                      amount_zig: "",
                    });
                  }}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  <Plus className="mr-1 h-4 w-4" /> Add Supplier Invoice
                </Button>
              </CardHeader>
              <CardContent>
                {supplierInvoices.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No supplier invoices recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Due Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                          <TableHead className="text-right">Paid (US$ / ZiG)</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierInvoices.map((si) => (
                          <TableRow key={si.id}>
                            <TableCell className="font-medium">{si.supplier_name}</TableCell>
                            <TableCell className="font-mono text-xs">{si.invoice_number}</TableCell>
                            <TableCell className="text-xs">{si.invoice_date}</TableCell>
                            <TableCell className="text-xs">{si.due_date || "-"}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{si.description || "-"}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(si.amount_usd)}</TableCell>
                            <TableCell className="text-right font-mono text-green-700">{fmt(si.paid_usd)}</TableCell>
                            <TableCell className="text-right font-mono text-destructive">
                              {formatMoney(Number(si.amount_usd) - Number(si.paid_usd))}
                            </TableCell>
                            <TableCell>{statusBadge(si.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {si.status !== "paid" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    title="Record payment"
                                    onClick={() => {
                                      setSpInvoice(si);
                                      setSpDialogOpen(true);
                                      setSpForm({
                                        payment_date: new Date().toISOString().split("T")[0],
                                        amount_usd: "",
                                        amount_zig: "",
                                        payment_method: "cash",
                                        reference_number: "",
                                        notes: "",
                                      });
                                    }}
                                  >
                                    <CreditCard className="h-4 w-4 text-green-700" />
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" onClick={() => deleteSupplierInvoice(si.id)}>
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

            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Supplier Payments History</CardTitle>
              </CardHeader>
              <CardContent>
                {supplierPayments.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">No supplier payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Invoice #</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {supplierPayments.map((sp) => (
                          <TableRow key={sp.id}>
                            <TableCell className="text-xs">{sp.payment_date}</TableCell>
                            <TableCell className="font-medium">{sp.supplier_invoices?.supplier_name || "-"}</TableCell>
                            <TableCell className="font-mono text-xs">
                              {sp.supplier_invoices?.invoice_number || "-"}
                            </TableCell>
                            <TableCell>{paymentMethodLabel(sp.payment_method)}</TableCell>
                            <TableCell className="font-mono text-xs">{sp.reference || "-"}</TableCell>
                            <TableCell className="text-right font-mono">{formatMoney(sp.amount_usd)}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{sp.notes || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Statements Tab – updated with positive credit display */}
        <TabsContent value="statements">
          <Card>
            <CardHeader>
              <CardTitle className="font-heading">Student Financial Statements</CardTitle>
              <CardDescription>Search for a student to view their full financial history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!stmtStudent ? (
                <div className="space-y-2">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name or admission number…"
                      value={stmtSearch}
                      onChange={(e) => {
                        setStmtSearch(e.target.value);
                        searchStmtStudents(e.target.value);
                      }}
                      className="pl-9"
                    />
                  </div>
                  {stmtStudentResults.length > 0 && (
                    <div className="border rounded-md max-w-md divide-y">
                      {stmtStudentResults.map((s) => (
                        <button
                          key={s.id}
                          className="w-full text-left px-4 py-2 hover:bg-muted/50 transition-colors flex justify-between items-center"
                          onClick={() => selectStmtStudent(s)}
                        >
                          <span className="font-medium">{s.full_name}</span>
                          <span className="text-xs text-muted-foreground">
                            {s.admission_number} • {s.form}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : stmtLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-accent" />
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <Button variant="ghost" size="icon" onClick={clearStmtStudent}>
                        <ArrowLeft className="h-4 w-4" />
                      </Button>
                      <div>
                        <p className="font-semibold text-lg">{stmtStudent.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {stmtStudent.admission_number} • {stmtStudent.form}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => selectStmtStudent(stmtStudent)}
                        title="Refresh statement"
                      >
                        <RefreshCw className={`h-4 w-4 ${stmtLoading ? "animate-spin" : ""}`} />
                      </Button>
                      <DocActionButtons
                        labels
                        actions={statementActions(
                          {
                            fullName: stmtStudent.full_name,
                            admissionNumber: stmtStudent.admission_number,
                            form: stmtStudent.form,
                          },
                          stmtInvoices,
                          stmtPayments,
                        )}
                        email={{
                          documentLabel: "Student Statement",
                          filename: `statement-${(stmtStudent.full_name || "student").replace(/\s+/g, "-").toLowerCase()}`,
                          subject: `Statement of Account: ${stmtStudent.full_name}`,
                        }}
                      />
                    </div>
                  </div>


                  {(() => {
                    const tInvUsd = stmtInvoices.reduce((s, i) => s + Number(i.total_usd), 0);
                    const tInvZig = stmtInvoices.reduce((s, i) => s + Number(i.total_zig), 0);
                    const tPaidUsd = stmtPayments.reduce((s, p) => s + Number(p.amount_usd), 0);
                    const tPaidZig = stmtPayments.reduce((s, p) => s + Number(p.amount_zig), 0);
                    const balUsd = tInvUsd - tPaidUsd;
                    const balZig = tInvZig - tPaidZig;
                    const isCredit = balUsd < 0;
                    return (
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase">Total Invoiced</p>
                            <p className="font-bold font-mono">{fmt(tInvUsd)}</p>
                            <p className="text-sm text-muted-foreground font-mono">ZiG {fmt(tInvZig)}</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase">Total Paid</p>
                            <p className="font-bold font-mono text-green-700">{fmt(tPaidUsd)}</p>
                            <p className="text-sm text-muted-foreground font-mono">ZiG {fmt(tPaidZig)}</p>
                          </CardContent>
                        </Card>
                        <Card
                          className={
                            isCredit ? "bg-green-50 border-green-200" : balUsd > 0 ? "bg-destructive/5" : "bg-muted"
                          }
                        >
                          <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase">Balance</p>
                            <p
                              className={`font-bold font-mono ${isCredit ? "text-green-700" : balUsd > 0 ? "text-destructive" : "text-muted-foreground"}`}
                            >
                               US$ {isCredit ? fmt(Math.abs(balUsd)) : fmt(balUsd)}
                            </p>
                            <p className="text-sm text-muted-foreground font-mono">
                              ZiG {balZig < 0 ? fmt(Math.abs(balZig)) : fmt(balZig)}
                            </p>
                            {isCredit && <span className="text-xs text-green-600">(credit)</span>}
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })()}

                  <div>
                    <h3 className="font-semibold mb-2">Invoices ({stmtInvoices.length})</h3>
                    {stmtInvoices.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No invoices found.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Invoice #</TableHead>
                              <TableHead>Term</TableHead>
                              <TableHead>Year</TableHead>
                              <TableHead className="text-right">Total (US$)</TableHead>
                              <TableHead className="text-right">Paid (US$)</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stmtInvoices.map((i) => (
                              <TableRow key={i.id}>
                                <TableCell className="font-mono text-xs">{i.invoice_number}</TableCell>
                                <TableCell>{i.term}</TableCell>
                                <TableCell>{i.academic_year}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(Number(i.total_usd))}</TableCell>
                                <TableCell className="text-right font-mono">{fmt(Number(i.paid_usd))}</TableCell>
                                <TableCell>{statusBadge(i.status)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Payments ({stmtPayments.length})</h3>
                    {stmtPayments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No payments recorded.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Receipt #</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead>Invoice</TableHead>
                              <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                              <TableHead>Method</TableHead>
                              <TableHead>Ref</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stmtPayments.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                                <TableCell>{p.payment_date}</TableCell>
                                <TableCell className="font-mono text-xs">{p.invoices?.invoice_number || "-"}</TableCell>
                                <TableCell className="text-right font-mono">{formatMoney(p.amount_usd)}</TableCell>
                                <TableCell>{paymentMethodLabel(p.payment_method)}</TableCell>
                                <TableCell className="text-xs">{p.reference_number || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expenses Tab – with date filter, search and view/print/download/email */}
        <TabsContent value="expenses">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading">Expenses</CardTitle>
                <CardDescription>Track school expenditures</CardDescription>
              </div>
              <Button
                onClick={() => {
                  setExpDialogOpen(true);
                  setExpForm({
                    expense_date: new Date().toISOString().split("T")[0],
                    category: "General",
                    description: "",
                    amount_usd: "",
                    amount_zig: "",
                    payment_method: "cash",
                    reference_number: "",
                  });
                }}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Plus className="mr-1 h-4 w-4" /> Record Expense
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description, category, method, ref…"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <DateRangeFilter value={expenseDateFilter} onChange={setExpenseDateFilter} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span className="text-muted-foreground">
                  Showing <strong>{filteredExpenses.length}</strong> of {expenses.length} · Total
                  <strong className="text-destructive">{formatMoney(filteredExpenses.reduce((s, e) => s + Number(e.amount_usd), 0))}</strong>
                </span>
                <DocActionButtons
                  labels
                  actions={expensesListActions({
                    periodLabel: expenseDateFilter.day
                      ? expenseDateFilter.day
                      : `${expenseDateFilter.month === "all" ? "All Months" : new Date(0, parseInt(expenseDateFilter.month)).toLocaleString("en-US", { month: "long" })} ${expenseDateFilter.year === "all" ? "All Years" : expenseDateFilter.year}`,
                    expenses: filteredExpenses,
                  })}
                  email={{
                    documentLabel: "Expenses Report",
                    filename: "expenses-report",
                    subject: `Concepts Learning Academy – Expenses Report`,
                  }}
                />
              </div>

              {filteredExpenses.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No expenses match the current filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount (US$ / ZiG)</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-center">Document</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredExpenses.map((exp) => (
                        <TableRow key={exp.id}>
                          <TableCell>{exp.expense_date}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{exp.category}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[250px] truncate">{exp.description}</TableCell>
                          <TableCell className="text-right font-mono">{formatMoney(exp.amount_usd)}</TableCell>
                          <TableCell>{paymentMethodLabel(exp.payment_method)}</TableCell>
                          <TableCell className="text-center">
                            <DocActionButtons
                              actions={expensesListActions({
                                periodLabel: exp.expense_date,
                                expenses: [exp],
                              })}
                              email={{
                                documentLabel: "Expense Voucher",
                                filename: `expense-${exp.expense_date}-${(exp.category || "general").toLowerCase()}`,
                                subject: `Expense voucher – ${exp.category} – ${exp.expense_date}`,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => deleteExpense(exp.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Bank Reconciliation Tab – unchanged */}
        <TabsContent value="bank-recon">
          <BankReconciliation />
        </TabsContent>

        {/* Income & Expenditure Tab – unchanged */}
        <TabsContent value="income-expenditure">
          <IncomeExpenditureReport />
        </TabsContent>

        {/* Reports Tab – unchanged */}
        <TabsContent value="reports">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Collection Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Total USD Collected</p>
                    <p className="text-lg font-bold text-green-700">{formatMoney(totalCollectedUsd)}</p>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Current ZiG Collected</p>
                    <p className="text-2xl font-bold text-green-700">ZiG {fmt(totalCollectedZig)}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">By Payment Method</h4>
                  {OFFICE_PAYMENT_METHODS.map((method) => {
                    const methodPayments = payments.filter((p) => p.payment_method === method);
                    const mUsd = methodPayments.reduce((s, p) => s + Number(p.amount_usd), 0);
                    const mZig = methodPayments.reduce((s, p) => s + Number(p.amount_zig), 0);
                    if (mUsd === 0 && mZig === 0) return null;
                    return (
                      <div key={method} className="flex items-center justify-between text-sm border-b pb-1">
                        <span>{paymentMethodLabel(method)}</span>
                        <span className="font-mono">
                           US$ {fmt(mUsd)} / ZiG {fmt(mZig)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-heading">Income vs Expenditure</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Income (US$)</span>
                    <span className="font-mono font-bold text-green-700">{formatMoney(totalCollectedUsd)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Expenses (US$)</span>
                    <span className="font-mono font-bold text-red-600">{formatMoney(totalExpensesUsd)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="text-sm font-semibold">Net (US$)</span>
                    <span
                      className={`font-mono font-bold ${totalCollectedUsd - totalExpensesUsd >= 0 ? "text-green-700" : "text-red-600"}`}
                    >
                      {formatMoney(totalCollectedUsd - totalExpensesUsd)}
                    </span>
                  </div>
                </div>
                <div className="border-t pt-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Income (ZiG)</span>
                    <span className="font-mono font-bold text-green-700">ZiG {fmt(totalCollectedZig)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Expenses (US$)</span>
                    <span className="font-mono font-bold text-red-600">ZiG {fmt(totalExpensesZig)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between items-center">
                    <span className="text-sm font-semibold">Net (US$)</span>
                    <span
                      className={`font-mono font-bold ${totalCollectedZig - totalExpensesZig >= 0 ? "text-green-700" : "text-red-600"}`}
                    >
                      ZiG {fmt(totalCollectedZig - totalExpensesZig)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-heading">Fee Collection Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {invoices.length === 0 ? (
                  <p className="text-center py-4 text-muted-foreground">No data available</p>
                ) : (
                  <div className="space-y-3">
                    {["Term 1", "Term 2", "Term 3"].map((term) => {
                      const termInvs = invoices.filter((i) => i.term === term);
                      if (termInvs.length === 0) return null;
                      const totalUsd = termInvs.reduce((s, i) => s + Number(i.total_usd), 0);
                      const paidUsd = termInvs.reduce((s, i) => s + Number(i.paid_usd), 0);
                      const pct = totalUsd > 0 ? (paidUsd / totalUsd) * 100 : 0;
                      return (
                        <div key={term}>
                          <div className="flex justify-between text-sm mb-1">
                            <span>{term}</span>
                            <span className="font-mono">
                              {pct.toFixed(1)}% collected ({fmt(paidUsd)} / {fmt(totalUsd)})
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-accent transition-all"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ═══ DIALOGS ═══ */}
      {/* Fee Structure Dialog */}
      <Dialog open={feeDialogOpen} onOpenChange={setFeeDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFee ? "Edit Fee Structure" : "Add Fee Structure"}</DialogTitle>
            <DialogDescription>Enter the fee amount in US Dollars (US$).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Input
                  value={feeForm.academic_year}
                  onChange={(e) => setFeeForm((p) => ({ ...p, academic_year: e.target.value }))}
                  placeholder="2026"
                />
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={feeForm.term} onValueChange={(v) => setFeeForm((p) => ({ ...p, term: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {termOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Form</Label>
                <Select value={feeForm.form} onValueChange={(v) => setFeeForm((p) => ({ ...p, form: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_LEVELS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Boarding Status</Label>
                <Select
                  value={feeForm.boarding_status}
                  onValueChange={(v) => setFeeForm((p) => ({ ...p, boarding_status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {boardingOptions.map((b) => (
                      <SelectItem key={b.value} value={b.value}>
                        {b.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={feeForm.description}
                onChange={(e) => setFeeForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Tuition + Levy"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (US$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={feeForm.amount_usd}
                  onChange={(e) => setFeeForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                  placeholder="0.00"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFeeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveFee}
              disabled={feeLoading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {feeLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {editingFee ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Invoice Dialog */}
      <Dialog open={bulkInvoiceOpen} onOpenChange={setBulkInvoiceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Generate Invoices</DialogTitle>
            <DialogDescription>Generate invoices for all active students based on fee structures.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Academic Year</Label>
                <Input value={bulkYear} onChange={(e) => setBulkYear(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Term</Label>
                <Select value={bulkTerm} onValueChange={setBulkTerm}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {termOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={bulkDueDate} onChange={(e) => setBulkDueDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkInvoiceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={generateBulkInvoices}
              disabled={bulkLoading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {bulkLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Generate Invoices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Invoice Dialog */}
      <Dialog open={singleInvOpen} onOpenChange={setSingleInvOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Invoice for Student</DialogTitle>
            <DialogDescription>Generate an invoice for a specific student</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Search Student *</Label>
              <Input
                placeholder="Type student name or admission #..."
                value={singleInvForm.student_search}
                onChange={(e) => {
                  setSingleInvForm((f) => ({ ...f, student_search: e.target.value }));
                  searchSingleInvStudents(e.target.value);
                }}
              />
              {singleInvStudentResults.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {singleInvStudentResults.map((s) => (
                    <div
                      key={s.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => selectSingleInvStudent(s)}
                    >
                      {s.full_name} · {s.admission_number} ({s.form})
                    </div>
                  ))}
                </div>
              )}
              {singleInvSelectedStudent && (
                <Badge variant="outline" className="mt-1">
                  {singleInvSelectedStudent.full_name} · {singleInvSelectedStudent.admission_number}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Academic Year</Label>
                <Select
                  value={singleInvForm.academic_year}
                  onValueChange={(v) => {
                    setSingleInvForm((f) => ({ ...f, academic_year: v }));
                    if (singleInvSelectedStudent) fetchFeeStructuresForStudent(singleInvSelectedStudent);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["2024", "2025", "2026", "2027"].map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Term</Label>
                <Select
                  value={singleInvForm.term}
                  onValueChange={(v) => {
                    setSingleInvForm((f) => ({ ...f, term: v }));
                    if (singleInvSelectedStudent) fetchFeeStructuresForStudent(singleInvSelectedStudent);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {termOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Fee Structure</Label>
              <Select
                value={selectedFeeStructure?.id || ""}
                onValueChange={(id) => {
                  const fs = availableFeeStructures.find((f) => f.id === id);
                  setSelectedFeeStructure(fs);
                  if (fs)
                    setSingleInvForm((f) => ({
                      ...f,
                      amount_usd: String(fs.amount_usd),
                      amount_zig: String(fs.amount_zig),
                      description: fs.description || "",
                    }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a fee structure" />
                </SelectTrigger>
                <SelectContent>
                  {availableFeeStructures.map((fs) => (
                    <SelectItem key={fs.id} value={fs.id}>
                      {fs.description || `${fs.form} - ${fs.boarding_status === "boarding" ? "Boarding" : "Day"} Fees`}{" "}
                      –  US$ {fs.amount_usd} / ZiG {fs.amount_zig}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Due Date (optional)</Label>
              <Input
                type="date"
                value={singleInvForm.due_date}
                onChange={(e) => setSingleInvForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSingleInvOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={createSingleInvoice}
              disabled={
                singleInvLoading ||
                !singleInvSelectedStudent ||
                (!singleInvForm.amount_usd && !singleInvForm.amount_zig)
              }
            >
              {singleInvLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>Record a payment in US Dollars (US$).</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Search Student</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Name or admission #"
                  value={payForm.student_search}
                  onChange={(e) => {
                    setPayForm((p) => ({ ...p, student_search: e.target.value }));
                    searchStudents(e.target.value);
                  }}
                />
              </div>
              {studentResults.length > 0 && (
                <div className="border rounded-md max-h-32 overflow-y-auto">
                  {studentResults.map((s) => (
                    <button
                      key={s.id}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                      onClick={() => selectStudentForPayment(s)}
                    >
                      {s.full_name} ({s.admission_number}) - {s.form}
                    </button>
                  ))}
                </div>
              )}
              {selectedStudent && (
                <p className="text-sm text-accent font-medium">Selected: {selectedStudent.full_name}</p>
              )}
            </div>
            {selectedStudent && studentInvoices.length > 0 && (
              <div className="space-y-2">
                <Label>Select Invoice</Label>
                <Select value={payForm.invoice_id} onValueChange={(v) => setPayForm((p) => ({ ...p, invoice_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select invoice" />
                  </SelectTrigger>
                  <SelectContent>
                    {studentInvoices.map((inv) => {
                      const balUsd = Number(inv.total_usd) - Number(inv.paid_usd);
                      const balZig = Number(inv.total_zig) - Number(inv.paid_zig);
                      return (
                        <SelectItem key={inv.id} value={inv.id}>
                          {inv.invoice_number} ·{" "}
                          {balUsd < 0 ? `+${fmt(Math.abs(balUsd))} credit` : `${fmt(balUsd)} owing`} /{" "}
                          {balZig < 0 ? `+ZiG ${fmt(Math.abs(balZig))} credit` : `ZiG ${fmt(balZig)} owing`}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            {selectedStudent && studentInvoices.length === 0 && (
               <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <p className="text-sm text-destructive font-medium">
                  No invoice found for this student. Please register them for the current term first.
                </p>
                <p className="text-xs text-muted-foreground mt-1">Go to Student Management → Term Registration to create a term invoice.</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Amount (US$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payForm.amount_usd}
                  onChange={(e) => setPayForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Amount ZiG <span className="text-xs text-muted-foreground">auto</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={payForm.amount_zig}
                  readOnly
                  className="bg-muted"
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={payForm.payment_method}
                  onValueChange={(v) => setPayForm((p) => ({ ...p, payment_method: v as PaymentMethod }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {paymentMethodLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {payForm.payment_method !== "cash" && (
                <div className="space-y-2">
                  <Label>Reference #</Label>
                  <Input
                    value={payForm.reference_number}
                    onChange={(e) => setPayForm((p) => ({ ...p, reference_number: e.target.value }))}
                    placeholder="e.g. TXN123"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={payForm.payment_date}
                onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={payForm.notes}
                onChange={(e) => setPayForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
                placeholder="Optional notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={recordPayment}
              disabled={payLoading}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              {payLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Invoice Dialog */}
      <Dialog open={siDialogOpen} onOpenChange={setSiDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Supplier Invoice</DialogTitle>
            <DialogDescription>Record an invoice received from a supplier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Supplier Name *</Label>
                <Input
                  value={siForm.supplier_name}
                  onChange={(e) => setSiForm((p) => ({ ...p, supplier_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Supplier Contact</Label>
                <Input
                  value={siForm.supplier_contact}
                  onChange={(e) => setSiForm((p) => ({ ...p, supplier_contact: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Invoice Number *</Label>
                <Input
                  value={siForm.invoice_number}
                  onChange={(e) => setSiForm((p) => ({ ...p, invoice_number: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Invoice Date</Label>
                <Input
                  type="date"
                  value={siForm.invoice_date}
                  onChange={(e) => setSiForm((p) => ({ ...p, invoice_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={siForm.due_date}
                  onChange={(e) => setSiForm((p) => ({ ...p, due_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Input
                  value={siForm.description}
                  onChange={(e) => setSiForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (US$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={siForm.amount_usd}
                  onChange={(e) => setSiForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Amount ZiG <span className="text-xs text-muted-foreground">auto</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={siForm.amount_zig}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSiDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveSupplierInvoice}
              disabled={siLoading || !siForm.supplier_name || !siForm.invoice_number}
            >
              {siLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Payment Dialog */}
      <Dialog
        open={spDialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            setSpDialogOpen(false);
            setSpInvoice(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Supplier Payment</DialogTitle>
            <DialogDescription>
              {spInvoice
                ? `Payment for ${spInvoice.supplier_name}: Invoice #${spInvoice.invoice_number} (Balance:  US$ ${fmt(Number(spInvoice.amount_usd) - Number(spInvoice.paid_usd))})`
                : "Select an unpaid supplier invoice and record a payment."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {!spInvoice && (
              <div className="space-y-1">
                <Label>Select Supplier Invoice *</Label>
                <Select
                  onValueChange={(v) => {
                    const inv = supplierInvoices.find((si) => si.id === v);
                    setSpInvoice(inv || null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an unpaid invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {supplierInvoices
                      .filter((si) => si.status !== "paid")
                      .map((si) => (
                        <SelectItem key={si.id} value={si.id}>
                          {si.supplier_name} · #{si.invoice_number} (Bal:  US$ $
                          {fmt(Number(si.amount_usd) - Number(si.paid_usd))})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={spForm.payment_date}
                  onChange={(e) => setSpForm((p) => ({ ...p, payment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select
                  value={spForm.payment_method}
                  onValueChange={(v) => setSpForm((p) => ({ ...p, payment_method: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {paymentMethodLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (US$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={spForm.amount_usd}
                  onChange={(e) => setSpForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Amount ZiG <span className="text-xs text-muted-foreground">auto</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={spForm.amount_zig}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reference Number</Label>
              <Input
                value={spForm.reference_number}
                onChange={(e) => setSpForm((p) => ({ ...p, reference_number: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={spForm.notes}
                onChange={(e) => setSpForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSpDialogOpen(false);
                setSpInvoice(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveSupplierPayment} disabled={spLoading || (!spForm.amount_usd && !spForm.amount_zig)}>
              {spLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cash on Delivery Dialog */}
      <Dialog open={codDialogOpen} onOpenChange={setCodDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cash on Delivery Payment</DialogTitle>
            <DialogDescription>
              Record a direct payment to a supplier for goods/services received on delivery.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Supplier Name *</Label>
                <Input
                  value={codForm.supplier_name}
                  onChange={(e) => setCodForm((p) => ({ ...p, supplier_name: e.target.value }))}
                  placeholder="e.g. ABC Supplies"
                />
              </div>
              <div className="space-y-1">
                <Label>Supplier Contact</Label>
                <Input
                  value={codForm.supplier_contact}
                  onChange={(e) => setCodForm((p) => ({ ...p, supplier_contact: e.target.value }))}
                  placeholder="Phone or email"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input
                value={codForm.description}
                onChange={(e) => setCodForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Office stationery delivery"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment Date</Label>
                <Input
                  type="date"
                  value={codForm.payment_date}
                  onChange={(e) => setCodForm((p) => ({ ...p, payment_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select
                  value={codForm.payment_method}
                  onValueChange={(v) => setCodForm((p) => ({ ...p, payment_method: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OFFICE_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {paymentMethodLabel(m)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (US$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={codForm.amount_usd}
                  onChange={(e) => setCodForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Amount ZiG <span className="text-xs text-muted-foreground">auto</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={codForm.amount_zig}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reference Number</Label>
              <Input
                value={codForm.reference_number}
                onChange={(e) => setCodForm((p) => ({ ...p, reference_number: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={codForm.notes}
                onChange={(e) => setCodForm((p) => ({ ...p, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCodDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveCodPayment}
              disabled={codLoading || !codForm.supplier_name || (!codForm.amount_usd && !codForm.amount_zig)}
            >
              {codLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Record COD Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Petty Cash Dialog */}
      <Dialog open={pcDialogOpen} onOpenChange={setPcDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pcForm.transaction_type === "deposit" ? "Deposit to Petty Cash" : "Petty Cash Withdrawal"}
            </DialogTitle>
            <DialogDescription>
              Record a {pcForm.transaction_type} transaction for the petty cash float.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={pcForm.transaction_date}
                  onChange={(e) => setPcForm((p) => ({ ...p, transaction_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Type</Label>
                <Select
                  value={pcForm.transaction_type}
                  onValueChange={(v) =>
                    setPcForm((p) => ({
                      ...p,
                      transaction_type: v,
                      reference_number: v === "deposit" ? "" : p.reference_number,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input
                value={pcForm.description}
                onChange={(e) => setPcForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Office supplies, Float top-up"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (US$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pcForm.amount_usd}
                  onChange={(e) => setPcForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Amount ZiG <span className="text-xs text-muted-foreground">auto</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={pcForm.amount_zig}
                  readOnly
                  className="bg-muted"
                />
              </div>
            </div>
            {pcForm.transaction_type === "withdrawal" && (
              <div className="space-y-1">
                <Label>Reference Number</Label>
                <Input
                  value={pcForm.reference_number}
                  onChange={(e) => setPcForm((p) => ({ ...p, reference_number: e.target.value }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPcDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={savePettyCash} disabled={pcLoading || !pcForm.description}>
              {pcLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Expense Dialog */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogDescription>Log a school expenditure entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={expForm.expense_date}
                  onChange={(e) => setExpForm((p) => ({ ...p, expense_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={expForm.category}
                  onValueChange={(v) => setExpForm((p) => ({ ...p, category: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description *</Label>
              <Input
                value={expForm.description}
                onChange={(e) => setExpForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Electricity bill – July"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount (US$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={expForm.amount_usd}
                  onChange={(e) => setExpForm((p) => ({ ...p, amount_usd: e.target.value, amount_zig: autoZig(e.target.value) }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Method</Label>
                <Select
                  value={expForm.payment_method}
                  onValueChange={(v) => setExpForm((p) => ({ ...p, payment_method: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OFFICE_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{paymentMethodLabel(m)}</SelectItem>
                    ))}
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Reference Number</Label>
              <Input
                value={expForm.reference_number}
                onChange={(e) => setExpForm((p) => ({ ...p, reference_number: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpDialogOpen(false)}>Cancel</Button>
            <Button onClick={saveExpense} disabled={expLoading || !expForm.description}>
              {expLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Delete Debtor Confirmation Dialog */}
      <Dialog
        open={deleteDebtorOpen}
        onOpenChange={(v) => {
          if (!v) {
            setDeleteDebtorOpen(false);
            setDebtorToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Debtor</DialogTitle>
            <DialogDescription>
              This will mark invoice <span className="font-mono font-semibold">{debtorToDelete?.invoice_number}</span>{" "}
              for <span className="font-semibold">{debtorToDelete?.students?.full_name}</span> as paid and remove them
              from the debtors list. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDebtorOpen(false);
                setDebtorToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingDebtor}
              onClick={async () => {
                if (!debtorToDelete) return;
                setDeletingDebtor(true);
                const { error } = await supabase
                  .from("invoices")
                  .update({ status: "paid", paid_usd: debtorToDelete.total_usd, paid_zig: debtorToDelete.total_zig })
                  .eq("id", debtorToDelete.id);
                if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
                else {
                  toast({
                    title: "Debtor removed",
                    description: `${debtorToDelete.students?.full_name} has been cleared from the debtors list.`,
                  });
                  setDebtors((prev) => prev.filter((d) => d.id !== debtorToDelete.id));
                  fetchInvoices();
                }
                setDeletingDebtor(false);
                setDeleteDebtorOpen(false);
                setDebtorToDelete(null);
              }}
            >
              {deletingDebtor && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Confirm Removal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Impact Modal */}
      <Dialog
        open={deleteImpactOpen}
        onOpenChange={(open) => {
          if (!deleteConfirmLoading) setDeleteImpactOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Fee Structure
            </DialogTitle>
            <DialogDescription>
              {deleteTargetFee && (
                <span className="block mt-1 font-medium text-foreground">
                  {deleteTargetFee.form} · {deleteTargetFee.term} {deleteTargetFee.academic_year} (
                  {deleteTargetFee.boarding_status === "boarding" ? "Boarding" : "Day"})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-3">
            {deleteImpactLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking impact…
              </div>
            ) : deleteImpactCount === -1 ? (
              <p className="text-sm text-destructive">Could not check linked invoice items. Proceed with caution.</p>
            ) : deleteImpactCount === 0 ? (
              <p className="text-sm text-muted-foreground">
                No invoice items are linked to this fee structure. It can be safely deleted.
              </p>
            ) : (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <p className="text-sm font-semibold text-amber-800">
                  {deleteImpactCount} invoice item{deleteImpactCount !== 1 ? "s" : ""} will be unlinked
                </p>
                <p className="text-xs text-amber-700">
                  These invoice items will remain on their invoices but their fee structure reference will be cleared.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteImpactOpen(false)} disabled={deleteConfirmLoading}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteFee}
              disabled={deleteImpactLoading || deleteConfirmLoading}
            >
              {deleteConfirmLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Delete Fee Structure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
