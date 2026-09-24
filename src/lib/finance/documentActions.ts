// Centralised view / print / download / email helpers for finance documents.
// Every document goes through the buildXxxHtml helpers which already render
// the school logo, address and contact details at the top.
import { supabase } from "@/integrations/supabase/client";
import {
  buildInvoiceHtml,
  buildReceiptHtml,
  buildStatementHtml,
  buildIncomeExpenditureHtml,
  buildExpensesListHtml,
  SCHOOL_LOGO_URL,
  type IncomeExpenditureInput,
  type ExpensesListInput,
} from "./pdf";
import { openPrintWindow, openViewWindow, downloadHtmlDocument } from "./print";
import type { Tables } from "@/integrations/supabase/types";

type InvoiceLine = { description: string; amount_usd: number; amount_zig: number };
export type DocInvoice = Pick<
  Tables<"invoices">,
  "id" | "invoice_number" | "academic_year" | "term" | "due_date" | "total_usd" | "total_zig" | "paid_usd" | "paid_zig" | "status"
> & { _items?: InvoiceLine[] };
export type DocPayment = Pick<
  Tables<"payments">,
  "receipt_number" | "payment_date" | "amount_usd" | "amount_zig" | "payment_method" | "reference_number"
> & { invoices?: { invoice_number: string | null } | null };

export type DocStudent = {
  fullName: string;
  admissionNumber: string;
  form?: string | null;
};

export type DocActions = {
  view: () => void;
  print: () => void;
  download: () => void;
  /** Raw branded HTML - used by the Email dialog as an attachment-like body. */
  html: () => string;
};

function makeActions(html: string, filename: string): DocActions {
  return {
    view: () => openViewWindow(html),
    print: () => openPrintWindow(html),
    download: () => downloadHtmlDocument(html, filename),
    html: () => html,
  };
}

async function fetchInvoiceItems(invoiceId: string) {
  const { data } = await supabase
    .from("invoice_items")
    .select("description, amount_usd, amount_zig")
    .eq("invoice_id", invoiceId);
  return (data || []).map((it) => ({
    description: it.description,
    amount_usd: Number(it.amount_usd || 0),
    amount_zig: Number(it.amount_zig || 0),
  }));
}

export async function getInvoiceHtml(invoice: DocInvoice, student: DocStudent) {
  let items = invoice._items;
  if (!items) items = await fetchInvoiceItems(invoice.id);
  if (items.length === 0) {
    items = [{
      description: `${invoice.term || ""} ${invoice.academic_year || ""} fees`.trim() || "Tuition fees",
      amount_usd: Number(invoice.total_usd || 0),
      amount_zig: Number(invoice.total_zig || 0),
    }];
  }
  return buildInvoiceHtml({
    invoiceNumber: invoice.invoice_number,
    academicYear: invoice.academic_year,
    term: invoice.term,
    dueDate: invoice.due_date,
    student,
    items,
    totals: {
      total_usd: Number(invoice.total_usd || 0),
      total_zig: Number(invoice.total_zig || 0),
      paid_usd: Number(invoice.paid_usd || 0),
      paid_zig: Number(invoice.paid_zig || 0),
    },
  });
}

export async function invoiceActions(invoice: DocInvoice, student: DocStudent): Promise<DocActions> {
  const html = await getInvoiceHtml(invoice, student);
  return makeActions(html, `invoice-${invoice.invoice_number}`);
}

export function receiptActions(payment: DocPayment, student: DocStudent): DocActions {
  const html = buildReceiptHtml({
    logoUrl: SCHOOL_LOGO_URL,
    receiptNumber: payment.receipt_number,
    paymentDate: payment.payment_date,
    student,
    invoiceNumber: payment.invoices?.invoice_number,
    amounts: { usd: Number(payment.amount_usd || 0), zig: Number(payment.amount_zig || 0) },
    paymentMethod: payment.payment_method,
    referenceNumber: payment.reference_number,
  });
  return makeActions(html, `receipt-${payment.receipt_number}`);
}

export function statementActions(
  student: DocStudent,
  invoices: DocInvoice[],
  payments: DocPayment[],
): DocActions {
  const html = buildStatementHtml({
    logoUrl: SCHOOL_LOGO_URL,
    student,
    invoices: invoices.map((i) => ({
      invoice_number: i.invoice_number,
      term: i.term,
      academic_year: i.academic_year,
      total_usd: i.total_usd,
      total_zig: i.total_zig,
      paid_usd: i.paid_usd,
      paid_zig: i.paid_zig,
      status: i.status,
    })),
    payments: payments.map((p) => ({
      receipt_number: p.receipt_number,
      payment_date: p.payment_date,
      amount_usd: p.amount_usd,
      amount_zig: p.amount_zig,
      payment_method: p.payment_method,
    })),
  });
  const safeName = (student.fullName || "student").replace(/\s+/g, "-").toLowerCase();
  return makeActions(html, `statement-${safeName}`);
}

export function incomeExpenditureActions(input: IncomeExpenditureInput): DocActions {
  const html = buildIncomeExpenditureHtml({ ...input, logoUrl: input.logoUrl || SCHOOL_LOGO_URL });
  const safePeriod = (input.periodLabel || "report").replace(/\s+/g, "-").toLowerCase();
  return makeActions(html, `income-expenditure-${safePeriod}`);
}

export function expensesListActions(input: ExpensesListInput): DocActions {
  const html = buildExpensesListHtml({ ...input, logoUrl: input.logoUrl || SCHOOL_LOGO_URL });
  const safePeriod = (input.periodLabel || "report").replace(/\s+/g, "-").toLowerCase();
  return makeActions(html, `expenses-${safePeriod}`);
}
