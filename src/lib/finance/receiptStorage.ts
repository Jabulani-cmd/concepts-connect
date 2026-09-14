// Generates a receipt PDF from the branded HTML template, uploads it to the
// public school-media bucket under receipts/, and persists the resulting URL
// (plus verification metadata) onto the payments row.
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { buildReceiptHtml, SCHOOL_LOGO_URL, type ReceiptPrintInput } from "./pdf";

// Payment methods that self-verify (instant gateway) — bank transfer requires
// a clerk to review the uploaded proof-of-payment.
const INSTANT_METHODS = new Set([
  "card", "eft", "ecocash", "onemoney", "telecash", "paynow_web", "snapscan", "zapper", "online", "cash", "mobile_money", "paynow",
]);

export function isInstantMethod(method?: string | null): boolean {
  return !!method && INSTANT_METHODS.has(String(method).toLowerCase());
}

async function htmlToPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0";
  document.body.appendChild(iframe);
  try {
    const doc = iframe.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    await new Promise<void>((r) => {
      if (doc.readyState === "complete") r();
      else iframe.addEventListener("load", () => r(), { once: true });
    });
    await Promise.all(Array.from(doc.images || []).map((img) =>
      img.complete ? Promise.resolve() : new Promise<void>((res) => {
        img.addEventListener("load", () => res(), { once: true });
        img.addEventListener("error", () => res(), { once: true });
      })
    ));
    // @ts-ignore
    if (doc.fonts?.ready) { try { await doc.fonts.ready; } catch {} }
    await new Promise((r) => setTimeout(r, 100));

    const target = (doc.body || doc.documentElement) as HTMLElement;
    target.style.background = target.style.background || "#ffffff";
    const canvas = await html2canvas(target, {
      scale: 2, useCORS: true, backgroundColor: "#ffffff",
      windowWidth: target.scrollWidth, windowHeight: target.scrollHeight,
    });
    const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgW = pageW;
    const imgH = (canvas.height * imgW) / canvas.width;
    if (imgH <= pageH) {
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, imgH);
    } else {
      const pxPerPage = (canvas.width * pageH) / pageW;
      let rendered = 0; let first = true;
      while (rendered < canvas.height) {
        const sliceH = Math.min(pxPerPage, canvas.height - rendered);
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = sliceH;
        const ctx = slice.getContext("2d")!;
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, slice.width, slice.height);
        ctx.drawImage(canvas, 0, rendered, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        if (!first) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, imgW, (sliceH * imgW) / canvas.width);
        first = false; rendered += sliceH;
      }
    }
    return pdf.output("blob");
  } finally {
    document.body.removeChild(iframe);
  }
}

export type GenerateReceiptArgs = {
  paymentId: string;
  receiptNumber: string;
  paymentDate: string;
  paymentMethod: string;
  referenceNumber?: string | null;
  amount: number;
  student: { fullName: string; admissionNumber: string; form?: string | null };
  invoiceNumber?: string | null;
  autoVerify?: boolean;   // instant gateway payments: true
  verifiedBy?: string | null;
};

/**
 * Renders the branded receipt as a PDF, uploads it to school-media/receipts,
 * and updates the payment row with receipt_url (+ verified_at / verified_by
 * when autoVerify is on). Returns the public URL, or null on any failure
 * (the payment itself is left intact — the receipt can be regenerated later).
 */
export async function generateAndStoreReceipt(args: GenerateReceiptArgs): Promise<string | null> {
  try {
    const input: ReceiptPrintInput = {
      logoUrl: SCHOOL_LOGO_URL,
      receiptNumber: args.receiptNumber,
      paymentDate: args.paymentDate,
      student: args.student,
      invoiceNumber: args.invoiceNumber || undefined,
      amounts: { usd: args.amount, zig: args.amount },
      paymentMethod: args.paymentMethod,
      referenceNumber: args.referenceNumber || undefined,
    };
    const html = buildReceiptHtml(input);
    const blob = await htmlToPdfBlob(html);
    const safeName = args.receiptNumber.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `receipts/${safeName}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("school-media")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) { console.error("[receipt] upload failed", upErr); return null; }
    const { data: pub } = supabase.storage.from("school-media").getPublicUrl(path);
    const url = pub.publicUrl;

    const update: Record<string, any> = { receipt_url: url };
    if (args.autoVerify) {
      update.verified_at = new Date(args.paymentDate).toISOString();
      if (args.verifiedBy) update.verified_by = args.verifiedBy;
    }
    const { error: updErr } = await (supabase.from("payments") as any).update(update).eq("id", args.paymentId);
    if (updErr) console.error("[receipt] payment update failed", updErr);
    return url;
  } catch (e) {
    console.error("[receipt] generate failed", e);
    return null;
  }
}
