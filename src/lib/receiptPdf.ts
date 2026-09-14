// @ts-nocheck
// Simple HTML→print-window receipt generator (US$).
import { openPrintWindow } from "@/lib/finance/print";
import { SCHOOL_LOGO_URL } from "@/lib/finance/pdf";
import { formatMoney, CITY, COUNTRY } from "@/lib/currency";

interface ReceiptData {
  receiptNumber: string;
  parentName: string;
  studentName: string;
  amount: number;
  currency?: string;        // ignored — always USD (ZiG shown alongside)
  method: string;
  transactionId: string;
  plan: string;
  accessStart: Date | string;
  accessEnd: Date | string;
  date: Date | string;
}

const fmt = (d: Date | string) =>
  new Date(d).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });

export function buildSubscriptionReceiptHtml(r: ReceiptData) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `
  <html><head><title>Receipt ${r.receiptNumber}</title>
  <base href="${origin}/" />
  <style>
    body{font-family:Inter,system-ui,sans-serif;padding:32px;color:#0f172a;}
    .head{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0d9488;padding-bottom:16px;margin-bottom:24px;}
    .head img{height:90px;width:auto;max-width:140px;object-fit:contain;display:block;}
    .head h1{margin:0;color:#0f172a;font-size:22px;}
    .head .sub{color:#475569;font-size:13px;}
    table{width:100%;border-collapse:collapse;margin-top:12px;}
    td{padding:8px 6px;border-bottom:1px solid #e2e8f0;font-size:14px;}
    td:first-child{color:#475569;width:40%;}
    .total{font-size:20px;font-weight:700;color:#0d9488;margin-top:18px;text-align:right;}
    .stamp{margin-top:32px;display:inline-block;padding:8px 18px;border:3px solid #16a34a;color:#16a34a;font-weight:700;border-radius:8px;transform:rotate(-6deg);}
    .footer{margin-top:48px;font-size:12px;color:#64748b;text-align:center;border-top:1px solid #e2e8f0;padding-top:12px;}
    .demo{position:fixed;top:18px;right:18px;background:#f59e0b;color:#000;padding:4px 10px;font-weight:700;border-radius:6px;font-size:11px;}
  </style></head><body>
  <div class="demo">DEMO</div>
  <div class="head">
    <img src="${SCHOOL_LOGO_URL}" alt="School Logo" />
    <div>
      <h1>MavingTech Business Solutions</h1>
      <div class="sub">Official Subscription Receipt</div>
    </div>
  </div>

  <h2 style="margin:0 0 4px;">Receipt #${r.receiptNumber}</h2>
  <div style="color:#64748b;font-size:13px;margin-bottom:18px;">Issued ${fmt(r.date)}</div>

  <table>
    <tr><td>Parent</td><td>${r.parentName}</td></tr>
    <tr><td>Learner</td><td>${r.studentName}</td></tr>
    <tr><td>Plan</td><td>${r.plan}</td></tr>
    <tr><td>Payment Method</td><td>${r.method}</td></tr>
    <tr><td>Transaction ID</td><td>${r.transactionId}</td></tr>
    <tr><td>Access Period</td><td>${fmt(r.accessStart)} → ${fmt(r.accessEnd)}</td></tr>
  </table>

  <div class="total">Total Paid: ${formatMoney(r.amount)}</div>
  <div class="stamp">PAID</div>

  <div class="footer">
    Thank you for supporting your child's learning journey.<br/>
    MavingTech Business Solutions · ${CITY}, ${COUNTRY} · info@mavingtech.com
  </div>
  </body></html>`;
}

export function downloadSubscriptionReceipt(r: ReceiptData) {
  openPrintWindow(buildSubscriptionReceiptHtml(r));
}
