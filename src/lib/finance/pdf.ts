import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { formatMoney } from "@/lib/currency";

// School branding constants (Zimbabwean context)
export const SCHOOL_NAME = "MavingTech Business Solutions";
export const SCHOOL_MOTTO = "Empowering Your Business Through Technology";
export const SCHOOL_ADDRESS = "123 Samora Machel Avenue, Harare, Zimbabwe";
export const SCHOOL_PHONE = "+263 24 255 0123";
export const SCHOOL_EMAIL = "info@mbsmavingtech.ac.zw";
// Use an absolute URL so the logo resolves inside print windows (about:blank)
// and any other context that doesn't share the app's base URL.
export const SCHOOL_LOGO_PATH = "/images/school-logo-print.png";
export const SCHOOL_LOGO_URL =
  typeof window !== "undefined" && window.location?.origin
    ? `${window.location.origin}${SCHOOL_LOGO_PATH}`
    : SCHOOL_LOGO_PATH;

export type Money = { usd: number; zig: number };


export type InvoicePdfInput = {
  schoolName?: string;
  motto?: string;
  logoDataUrl?: string;
  invoiceNumber: string;
  academicYear: string;
  term: string;
  dueDate?: string | null;
  student: { fullName: string; admissionNumber: string; form?: string | null };
  items: { description: string; amount_usd: number; amount_zig: number }[];
  totals: { total_usd: number; total_zig: number; paid_usd: number; paid_zig: number };
};

export async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load image: ${res.status}`);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(blob);
  });
}

export function buildInvoicePdf(input: InvoicePdfInput): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const name = input.schoolName || SCHOOL_NAME;
  const motto = input.motto || SCHOOL_MOTTO;

  // ─── Header with logo ───
  const topY = 14;
  if (input.logoDataUrl) {
    try {
      const props = doc.getImageProperties(input.logoDataUrl);
      const aspectRatio = props.width && props.height ? props.width / props.height : 0.75;
      const logoHeight = 65;
      const logoWidth = logoHeight * aspectRatio;
      doc.addImage(input.logoDataUrl, "PNG", 14, 8, logoWidth, logoHeight);
    } catch {
      // Ignore logo rendering errors
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(name, pageWidth / 2, topY, { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.text(`"${motto}"`, pageWidth / 2, topY + 6, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(SCHOOL_ADDRESS, pageWidth / 2, topY + 11, { align: "center" });
  doc.text(`Tel: ${SCHOOL_PHONE}  |  Email: ${SCHOOL_EMAIL}`, pageWidth / 2, topY + 15, { align: "center" });

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("INVOICE", pageWidth / 2, topY + 24, { align: "center" });

  // Decorative line
  doc.setDrawColor(128, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(14, topY + 27, pageWidth - 14, topY + 27);
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);

  // Invoice details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const detailY = topY + 33;
  doc.text(`Invoice #: ${input.invoiceNumber}`, 14, detailY);
  doc.text(`Term: ${input.term}  |  Year: ${input.academicYear}`, 14, detailY + 5);
  doc.text(`Due Date: ${input.dueDate ? new Date(input.dueDate).toLocaleDateString() : "—"}`, 14, detailY + 10);

  // Student info
  doc.text(`Student: ${input.student.fullName}`, pageWidth / 2, detailY, { align: "left" });
  doc.text(`Admission #: ${input.student.admissionNumber}`, pageWidth / 2, detailY + 5);
  if (input.student.form) {
    doc.text(`Grade: ${input.student.form}`, pageWidth / 2, detailY + 10);
  }

  doc.line(14, detailY + 15, pageWidth - 14, detailY + 15);

  // Items table
  autoTable(doc, {
    startY: detailY + 19,
    head: [["Description", "Amount (US$ / ZiG)"]],
    body: input.items.map((it) => [
      it.description,
      formatMoney(it.amount_usd || 0),
    ]),
    theme: "grid",
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [13, 148, 136] },
    columnStyles: {
      0: { cellWidth: 130 },
      1: { halign: "right", cellWidth: 40 },
    },
  });

  const endY = (doc as any).lastAutoTable?.finalY || detailY + 70;

  const total = Number(input.totals.total_usd || 0);
  const paid = Number(input.totals.paid_usd || 0);
  const rawBal = total - paid;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`TOTAL:   ${formatMoney(total)}`, 14, endY + 10);
  doc.text(`PAID:    ${formatMoney(paid)}`, 14, endY + 16);

  doc.setDrawColor(13, 148, 136);
  doc.setLineWidth(0.5);
  doc.line(14, endY + 19, pageWidth - 14, endY + 19);
  doc.setDrawColor(0);

  doc.setFontSize(11);
  if (rawBal < 0) {
    doc.text(`CREDIT:  ${formatMoney(Math.abs(rawBal))}`, 14, endY + 26);
  } else {
    doc.text(`BALANCE: ${formatMoney(rawBal)}`, 14, endY + 26);
  }


  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, endY + 34);
  doc.text("This is a computer-generated document.", 14, endY + 38);

  return doc;
}

// ═══ INVOICE HTML (for view/print) ═══

export function buildInvoiceHtml(input: InvoicePdfInput): string {
  const safe = (s: any) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const name = input.schoolName || SCHOOL_NAME;
  const motto = input.motto || SCHOOL_MOTTO;
  const logoUrl = input.logoDataUrl || SCHOOL_LOGO_URL;

  const total = Number(input.totals.total_usd || 0);
  const paid = Number(input.totals.paid_usd || 0);
  const rawBal = total - paid;

  const itemRows = input.items.map(it => `
    <tr>
      <td>${safe(it.description)}</td>
      <td class="right mono">${formatMoney(it.amount_usd || 0)}</td>
    </tr>`).join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="${typeof window !== "undefined" ? window.location.origin : ""}/" />
  <title>Invoice ${safe(input.invoiceNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; max-width: 700px; margin: 0 auto; }
    .header { display:flex; justify-content:space-between; align-items:center; }
    .brand { display:flex; gap:14px; align-items:center; }
    .brand img { height:90px; width:auto; max-width:140px; object-fit:contain; display:block; }
    .brand-text h1 { font-size: 18px; margin: 0; }
    .brand-text .motto { color: #555; font-style: italic; font-size: 10px; margin: 2px 0; }
    .brand-text .address { color: #666; font-size: 9px; }
    .invoice-title { text-align: right; }
    .invoice-title strong { font-size: 14px; display: block; }
    .invoice-title .num { font-family: monospace; font-size: 12px; }
    .row { display:flex; justify-content:space-between; gap: 12px; }
    .muted { color: #444; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .right { text-align: right; }
    .divider { border-top: 2px solid #0d9488; margin: 14px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; font-size: 11px; }
    th { background: #0d9488; color: #fff; }
    .totals { margin-top: 14px; font-size: 12px; }
    .totals .balance { font-size: 14px; font-weight: bold; margin-top: 8px; border-top: 2px solid #0d9488; padding-top: 8px; }
    .footer { margin-top: 24px; font-size: 9px; color: #888; text-align: center; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${safe(logoUrl)}" alt="School Logo" />
      <div class="brand-text">
        <h1>${safe(name)}</h1>
        <div class="motto">"${safe(motto)}"</div>
        <div class="address">${safe(SCHOOL_ADDRESS)} | Tel: ${safe(SCHOOL_PHONE)}</div>
      </div>
    </div>
    <div class="invoice-title">
      <strong>INVOICE</strong>
      <div class="num">${safe(input.invoiceNumber)}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="row">
    <div>
      <div><strong>Student:</strong> ${safe(input.student.fullName)}</div>
      <div><strong>Admission #:</strong> <span class="mono">${safe(input.student.admissionNumber)}</span></div>
      ${input.student.form ? `<div><strong>Grade:</strong> ${safe(input.student.form)}</div>` : ""}
    </div>
    <div class="right">
      <div><strong>Term:</strong> ${safe(input.term)} | <strong>Year:</strong> ${safe(input.academicYear)}</div>
      <div><strong>Due Date:</strong> ${input.dueDate ? new Date(input.dueDate).toLocaleDateString("en-ZA") : "—"}</div>
      <div><strong>Date:</strong> ${new Date().toLocaleDateString("en-ZA")}</div>
    </div>
  </div>

  <table>
    <thead><tr><th>Description</th><th class="right">Amount (US$ / ZiG)</th></tr></thead>
    <tbody>${itemRows || "<tr><td colspan='2'>No items</td></tr>"}</tbody>
  </table>

  <div class="totals">
    <div><strong>Total:</strong> ${formatMoney(total)}</div>
    <div><strong>Paid:</strong> ${formatMoney(paid)}</div>
    <div class="balance">${rawBal < 0 ? `Credit Balance: ${formatMoney(Math.abs(rawBal))}` : `Balance Due: ${formatMoney(rawBal)}`}</div>
  </div>


  <div class="footer">
    <p>Generated: ${new Date().toLocaleString()} | This is a computer-generated document.</p>
    <p>${safe(name)} | ${safe(SCHOOL_ADDRESS)}</p>
  </div>
</body>
</html>`;
}

// ═══ RECEIPT HTML ═══

export type ReceiptPrintInput = {
  schoolName?: string;
  motto?: string;
  logoUrl?: string;
  receiptNumber: string;
  paymentDate: string;
  student: { fullName: string; admissionNumber: string; form?: string | null };
  invoiceNumber?: string | null;
  amounts: { usd: number; zig: number };
  paymentMethod: string;
  referenceNumber?: string | null;
};

export function buildReceiptHtml(input: ReceiptPrintInput) {
  const safe = (s: any) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const name = input.schoolName || SCHOOL_NAME;
  const motto = input.motto || SCHOOL_MOTTO;
  const logoUrl = input.logoUrl || SCHOOL_LOGO_URL;

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="${typeof window !== "undefined" ? window.location.origin : ""}/" />
  <title>Receipt ${safe(input.receiptNumber)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; font-size: 12px; max-width: 700px; margin: 0 auto; }
    .header { display:flex; justify-content:space-between; align-items:center; }
    .brand { display:flex; gap:14px; align-items:center; }
    .brand img { height:90px; width:auto; max-width:140px; object-fit:contain; display:block; }
    .brand-text h1 { font-size: 18px; margin: 0; }
    .brand-text .motto { color: #555; font-style: italic; font-size: 10px; margin: 2px 0; }
    .brand-text .address { color: #666; font-size: 9px; }
    .receipt-title { text-align: right; }
    .receipt-title strong { font-size: 14px; display: block; }
    .receipt-title .num { font-family: monospace; font-size: 12px; }
    .row { display:flex; justify-content:space-between; gap: 12px; }
    .muted { color: #444; }
    .box { border: 2px solid #0d9488; padding: 14px; margin-top: 14px; border-radius: 4px; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .right { text-align: right; }
    hr { border: 0; border-top: 1px solid #ccc; margin: 12px 0; }
    .divider { border-top: 2px solid #0d9488; margin: 14px 0; }
    .footer { margin-top: 20px; font-size: 9px; color: #888; text-align: center; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">
      <img src="${safe(logoUrl)}" alt="School Logo" />
      <div class="brand-text">
        <h1>${safe(name)}</h1>
        <div class="motto">"${safe(motto)}"</div>
        <div class="address">${safe(SCHOOL_ADDRESS)} | Tel: ${safe(SCHOOL_PHONE)}</div>
      </div>
    </div>
    <div class="receipt-title">
      <strong>OFFICIAL RECEIPT</strong>
      <div class="num">${safe(input.receiptNumber)}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="row">
    <div>
      <div><strong>Student:</strong> ${safe(input.student.fullName)}</div>
      <div><strong>Admission #:</strong> <span class="mono">${safe(input.student.admissionNumber)}</span></div>
      ${input.student.form ? `<div><strong>Grade:</strong> ${safe(input.student.form)}</div>` : ""}
    </div>
    <div class="right">
      <div><strong>Date:</strong> ${safe(input.paymentDate)}</div>
      ${input.invoiceNumber ? `<div><strong>Invoice:</strong> <span class="mono">${safe(input.invoiceNumber)}</span></div>` : ""}
    </div>
  </div>

  <div class="box">
    <div class="row">
      <div><strong>Payment Method:</strong> ${safe(input.paymentMethod)}</div>
      <div><strong>Reference:</strong> <span class="mono">${safe(input.referenceNumber || "—")}</span></div>
    </div>
    <hr />
    <div class="row">
      <div><strong>Amount Paid:</strong></div>
      <div class="mono" style="font-size:16px;"><strong>${formatMoney(input.amounts.usd || 0)}</strong></div>
    </div>
  </div>


  <p class="muted" style="margin-top: 16px;">Thank you for your payment. Please keep this receipt for your records.</p>

  <div class="footer">
    <p>This is a computer-generated receipt. | ${safe(name)} | ${safe(SCHOOL_ADDRESS)}</p>
  </div>
</body>
</html>`;
}

// ═══ STATEMENT HTML ═══

export type StatementPrintInput = {
  logoUrl?: string;
  student: { fullName: string; admissionNumber: string; form?: string | null };
  invoices: { invoice_number: string; term: string; academic_year: string; total_usd: number; total_zig: number; paid_usd: number; paid_zig: number; status: string }[];
  payments: { receipt_number: string; payment_date: string; amount_usd: number; amount_zig: number; payment_method: string }[];
};

export function buildStatementHtml(input: StatementPrintInput) {
  const safe = (s: any) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const logoUrl = input.logoUrl || SCHOOL_LOGO_URL;

  const invoiceRows = input.invoices.map(inv => {
    const total = Number(inv.total_usd || 0);
    const paid = Number(inv.paid_usd || 0);
    const balance = total - paid;
    return `
    <tr>
      <td class="mono">${safe(inv.invoice_number)}</td>
      <td>${safe(inv.term)} ${safe(inv.academic_year)}</td>
      <td class="right">${formatMoney(total)}</td>
      <td class="right">${formatMoney(paid)}</td>
      <td class="right">${balance < 0 ? `+${formatMoney(Math.abs(balance))} credit` : formatMoney(balance)}</td>
      <td>${safe(inv.status)}</td>
    </tr>`;
  }).join("");

  const paymentRows = input.payments.map(p => `
    <tr>
      <td class="mono">${safe(p.receipt_number)}</td>
      <td>${safe(p.payment_date)}</td>
      <td class="right">${formatMoney(p.amount_usd || 0)}</td>
      <td>${safe(p.payment_method)}</td>
    </tr>`).join("");

  const totalOwed = input.invoices.reduce((s, i) => s + (Number(i.total_usd) - Number(i.paid_usd)), 0);
  const balanceLabel = totalOwed < 0 ? 'Credit Balance' : 'Outstanding Balance';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <base href="${typeof window !== "undefined" ? window.location.origin : ""}/" />
  <title>Statement - ${safe(input.student.fullName)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; font-size: 11px; max-width: 800px; margin: 0 auto; }
    .header { display:flex; gap:14px; align-items:center; margin-bottom: 6px; }
    .header img { height:90px; width:auto; max-width:140px; object-fit:contain; display:block; }
    .header h1 { font-size: 18px; margin: 0; }
    .header .motto { color: #555; font-style: italic; font-size: 10px; }
    .header .address { color: #666; font-size: 9px; }
    .divider { border-top: 2px solid #0d9488; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 10px; }
    th { background: #0d9488; color: #fff; }
    .right { text-align: right; }
    .mono { font-family: monospace; }
    .balance { font-size: 13px; font-weight: bold; margin-top: 14px; }
    .footer { margin-top: 20px; font-size: 9px; color: #888; text-align: center; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <div class="header">
    <img src="${safe(logoUrl)}" alt="Logo" />
    <div>
      <h1>${safe(SCHOOL_NAME)}</h1>
      <div class="motto">"${safe(SCHOOL_MOTTO)}"</div>
      <div class="address">${safe(SCHOOL_ADDRESS)} | Tel: ${safe(SCHOOL_PHONE)}</div>
    </div>
  </div>
  <div class="divider"></div>

  <h2 style="font-size:14px; margin: 8px 0;">STUDENT ACCOUNT STATEMENT</h2>
  <p><strong>Student:</strong> ${safe(input.student.fullName)} &nbsp; | &nbsp; <strong>Admission #:</strong> <span class="mono">${safe(input.student.admissionNumber)}</span>${input.student.form ? ` &nbsp; | &nbsp; <strong>Grade:</strong> ${safe(input.student.form)}` : ""}</p>
  <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-ZA")}</p>

  <h3 style="margin-top:14px;">Invoices</h3>
  <table>
    <thead><tr><th>Invoice #</th><th>Period</th><th class="right">Total (R)</th><th class="right">Paid (R)</th><th class="right">Balance (R)</th><th>Status</th></tr></thead>
    <tbody>${invoiceRows || "<tr><td colspan='6'>No invoices</td></tr>"}</tbody>
  </table>

  <h3 style="margin-top:14px;">Payments</h3>
  <table>
    <thead><tr><th>Receipt #</th><th>Date</th><th class="right">Amount (US$ / ZiG)</th><th>Method</th></tr></thead>
    <tbody>${paymentRows || "<tr><td colspan='4'>No payments</td></tr>"}</tbody>
  </table>

  <div class="balance">${balanceLabel}: ${formatMoney(Math.abs(totalOwed))}</div>


  <div class="footer">
    <p>This is a computer-generated statement. | ${safe(SCHOOL_NAME)} | ${safe(SCHOOL_ADDRESS)}</p>
  </div>
</body>
</html>`;
}

// ═══ INCOME & EXPENDITURE HTML ═══

export type IncomeExpenditureInput = {
  logoUrl?: string;
  periodLabel: string; // e.g. "January 2026"
  income: { date: string; receipt: string; party: string; method: string; usd: number; zig: number; ref?: string }[];
  expenses: { date: string; category: string; description: string; method?: string; usd: number; zig: number }[];
  supplierPayments: { date: string; supplier: string; method?: string; ref?: string; usd: number; zig: number }[];
  totals: {
    incomeUsd: number; incomeZig: number;
    expensesUsd: number; expensesZig: number;
    supplierUsd: number; supplierZig: number;
    netUsd: number; netZig: number;
  };
  breakdownByCategory?: { category: string; usd: number; zig: number }[];
};

export function buildIncomeExpenditureHtml(input: IncomeExpenditureInput): string {
  const safe = (s: any) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const logoUrl = input.logoUrl || SCHOOL_LOGO_URL;
  const t = input.totals;

  const incomeRows = input.income.map(r => `
    <tr>
      <td>${safe(r.date)}</td>
      <td class="mono">${safe(r.receipt)}</td>
      <td>${safe(r.party)}</td>
      <td>${safe(r.method)}</td>
      <td class="right mono green">${formatMoney(r.usd)}</td>
      <td class="mono">${safe(r.ref || "—")}</td>
    </tr>`).join("");

  const expenseRows = input.expenses.map(r => `
    <tr>
      <td>${safe(r.date)}</td>
      <td>${safe(r.category)}</td>
      <td>${safe(r.description)}</td>
      <td>${safe(r.method || "—")}</td>
      <td class="right mono red">${formatMoney(r.usd)}</td>
    </tr>`).join("");

  const supplierRows = input.supplierPayments.map(r => `
    <tr>
      <td>${safe(r.date)}</td>
      <td>${safe(r.supplier)}</td>
      <td>${safe(r.method || "—")}</td>
      <td class="mono">${safe(r.ref || "—")}</td>
      <td class="right mono red">${formatMoney(r.usd)}</td>
    </tr>`).join("");

  const categoryRows = (input.breakdownByCategory || []).map(c => `
    <tr>
      <td>${safe(c.category)}</td>
      <td class="right mono">${formatMoney(c.usd)}</td>
    </tr>`).join("");


  return `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <base href="${typeof window !== "undefined" ? window.location.origin : ""}/" />
  <title>Income & Expenditure — ${safe(input.periodLabel)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; font-size: 11px; max-width: 900px; margin: 0 auto; color: #1a1a1a; }
    .header { display:flex; gap:18px; align-items:center; }
    .header img { height:90px; width:auto; max-width:140px; object-fit:contain; }
    .header h1 { font-size: 20px; margin: 0; color: #0f172a; }
    .header .motto { color: #555; font-style: italic; font-size: 11px; margin: 2px 0; }
    .header .address { color: #666; font-size: 10px; }
    .divider { border-top: 3px double #0d9488; margin: 14px 0; }
    .title-row { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 10px; }
    .title-row h2 { font-size: 16px; margin: 0; color: #0f172a; letter-spacing: 1px; }
    .title-row .period { font-size: 12px; color: #555; font-weight: bold; }
    .summary { display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 14px 0; }
    .stat { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px 12px; background: #f9fafb; }
    .stat .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
    .stat .val { font-size: 15px; font-weight: bold; font-family: monospace; margin-top: 4px; }
    .stat.income .val { color: #047857; }
    .stat.expense .val { color: #b91c1c; }
    .stat.net.pos { background: #ecfdf5; border-color: #a7f3d0; }
    .stat.net.neg { background: #fef2f2; border-color: #fecaca; }
    .stat.net.pos .val { color: #047857; }
    .stat.net.neg .val { color: #b91c1c; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-size: 10px; }
    th { background: #0f172a; color: #fff; font-weight: 600; }
    .right { text-align: right; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .green { color: #047857; }
    .red { color: #b91c1c; }
    h3 { font-size: 13px; color: #0f172a; margin: 18px 0 4px; border-left: 4px solid #0d9488; padding-left: 8px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #888; text-align: center; }
    @media print { body { padding: 12px; } .summary { gap: 6px; } }
  </style>
</head><body>
  <div class="header">
    <img src="${safe(logoUrl)}" alt="School Logo" />
    <div>
      <h1>${safe(SCHOOL_NAME)}</h1>
      <div class="motto">"${safe(SCHOOL_MOTTO)}"</div>
      <div class="address">${safe(SCHOOL_ADDRESS)} &nbsp;|&nbsp; Tel: ${safe(SCHOOL_PHONE)} &nbsp;|&nbsp; Email: ${safe(SCHOOL_EMAIL)}</div>
    </div>
  </div>
  <div class="divider"></div>

  <div class="title-row">
    <h2>INCOME &amp; EXPENDITURE REPORT</h2>
    <div class="period">Period: ${safe(input.periodLabel)}</div>
  </div>

  <div class="summary">
    <div class="stat income"><div class="label">Total Income</div><div class="val">${formatMoney(t.incomeUsd)}</div></div>
    <div class="stat expense"><div class="label">General Expenses</div><div class="val">${formatMoney(t.expensesUsd)}</div></div>
    <div class="stat expense"><div class="label">Supplier Payments</div><div class="val">${formatMoney(t.supplierUsd)}</div></div>
    <div class="stat net ${t.netUsd >= 0 ? "pos" : "neg"}"><div class="label">Net ${t.netUsd >= 0 ? "Surplus" : "Deficit"}</div><div class="val">${formatMoney(Math.abs(t.netUsd))}</div></div>
  </div>

  ${categoryRows ? `<h3>Expenditure breakdown by category</h3>
  <table><thead><tr><th>Category</th><th class="right">Amount (US$ / ZiG)</th></tr></thead><tbody>${categoryRows}</tbody></table>` : ""}

  <h3>Income — ${input.income.length} transaction(s)</h3>
  <table>
    <thead><tr><th>Date</th><th>Receipt #</th><th>Party / Student</th><th>Method</th><th class="right">Amount (US$ / ZiG)</th><th>Reference</th></tr></thead>
    <tbody>${incomeRows || `<tr><td colspan="6" style="text-align:center;color:#999;">No income recorded for this period.</td></tr>`}</tbody>
  </table>

  <h3>General Expenses — ${input.expenses.length} transaction(s)</h3>
  <table>
    <thead><tr><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th class="right">Amount (US$ / ZiG)</th></tr></thead>
    <tbody>${expenseRows || `<tr><td colspan="5" style="text-align:center;color:#999;">No expenses recorded for this period.</td></tr>`}</tbody>
  </table>

  <h3>Supplier Payments — ${input.supplierPayments.length} transaction(s)</h3>
  <table>
    <thead><tr><th>Date</th><th>Supplier</th><th>Method</th><th>Reference</th><th class="right">Amount (US$ / ZiG)</th></tr></thead>
    <tbody>${supplierRows || `<tr><td colspan="5" style="text-align:center;color:#999;">No supplier payments recorded for this period.</td></tr>`}</tbody>
  </table>


  <div class="footer">
    <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; This is a computer-generated financial report.</p>
    <p><strong>${safe(SCHOOL_NAME)}</strong> &nbsp;|&nbsp; ${safe(SCHOOL_ADDRESS)} &nbsp;|&nbsp; Tel ${safe(SCHOOL_PHONE)} &nbsp;|&nbsp; ${safe(SCHOOL_EMAIL)}</p>
  </div>
</body></html>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Expenses list (branded) – used by the Bursar Expenses tab for view/print/
// download/email of a filtered set of expense entries.
// ─────────────────────────────────────────────────────────────────────────────
export type ExpensesListInput = {
  logoUrl?: string;
  periodLabel: string;
  expenses: {
    expense_date: string;
    category: string;
    description: string;
    amount_usd: number;
    amount_zig: number;
    payment_method?: string;
    reference_number?: string;
  }[];
};

export function buildExpensesListHtml(input: ExpensesListInput): string {
  const safe = (s: any) => String(s ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const logoUrl = input.logoUrl || SCHOOL_LOGO_URL;

  const total = input.expenses.reduce((s, e) => s + Number(e.amount_usd || 0), 0);

  const rows = input.expenses.map((e, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${safe(e.expense_date)}</td>
      <td>${safe(e.category)}</td>
      <td>${safe(e.description)}</td>
      <td>${safe(e.payment_method || "—")}</td>
      <td class="mono">${safe(e.reference_number || "—")}</td>
      <td class="right mono red">${formatMoney(Number(e.amount_usd))}</td>
    </tr>`).join("");


  return `<!doctype html>
<html><head>
  <meta charset="utf-8" />
  <base href="${typeof window !== "undefined" ? window.location.origin : ""}/" />
  <title>Expenses Report — ${safe(input.periodLabel)}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; font-size: 11px; max-width: 900px; margin: 0 auto; color: #1a1a1a; }
    .header { display:flex; gap:18px; align-items:center; }
    .header img { height:90px; width:auto; max-width:140px; object-fit:contain; }
    .header h1 { font-size: 20px; margin: 0; color: #0f172a; }
    .header .motto { color: #555; font-style: italic; font-size: 11px; margin: 2px 0; }
    .header .address { color: #666; font-size: 10px; }
    .divider { border-top: 3px double #0d9488; margin: 14px 0; }
    .title-row { display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 10px; }
    .title-row h2 { font-size: 16px; margin: 0; color: #0f172a; letter-spacing: 1px; }
    .title-row .period { font-size: 12px; color: #555; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 18px; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; text-align: left; font-size: 10px; }
    th { background: #0f172a; color: #fff; font-weight: 600; }
    .right { text-align: right; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .red { color: #b91c1c; }
    tfoot td { font-weight: 700; background: #fef2f2; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 9px; color: #888; text-align: center; }
    @media print { body { padding: 12px; } }
  </style>
</head><body>
  <div class="header">
    <img src="${safe(logoUrl)}" alt="School Logo" />
    <div>
      <h1>${safe(SCHOOL_NAME)}</h1>
      <div class="motto">"${safe(SCHOOL_MOTTO)}"</div>
      <div class="address">${safe(SCHOOL_ADDRESS)} &nbsp;|&nbsp; Tel: ${safe(SCHOOL_PHONE)} &nbsp;|&nbsp; Email: ${safe(SCHOOL_EMAIL)}</div>
    </div>
  </div>
  <div class="divider"></div>

  <div class="title-row">
    <h2>EXPENSES REPORT</h2>
    <div class="period">Period: ${safe(input.periodLabel)}</div>
  </div>

  <table>
    <thead><tr><th>#</th><th>Date</th><th>Category</th><th>Description</th><th>Method</th><th>Reference</th><th class="right">Amount (US$ / ZiG)</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="7" style="text-align:center;color:#999;">No expenses recorded for this period.</td></tr>`}</tbody>
    <tfoot><tr><td colspan="6" class="right">TOTAL (${input.expenses.length} entries)</td><td class="right mono red">${formatMoney(total)}</td></tr></tfoot>
  </table>


  <div class="footer">
    <p>Generated: ${new Date().toLocaleString()} &nbsp;|&nbsp; This is a computer-generated expenses report.</p>
    <p><strong>${safe(SCHOOL_NAME)}</strong> &nbsp;|&nbsp; ${safe(SCHOOL_ADDRESS)} &nbsp;|&nbsp; Tel ${safe(SCHOOL_PHONE)} &nbsp;|&nbsp; ${safe(SCHOOL_EMAIL)}</p>
  </div>
</body></html>`;
}


