// Generates a receipt PDF from the branded HTML template, uploads it to the
// public school-media bucket under receipts/, and persists the resulting URL
// (plus verification metadata) onto the payments row.
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { buildReceiptHtml, SCHOOL_LOGO_URL, type ReceiptPrintInput } from "./pdf";
import { renderHtmlToPdf } from "./print";

// Payment methods that self-verify (instant gateway) — bank transfer requires
// a clerk to review the uploaded proof-of-payment.
const INSTANT_METHODS = new Set([
  "card", "eft", "ecocash", "onemoney", "telecash", "paynow_web", "online", "cash", "mobile_money", "paynow",
]);

export function isInstantMethod(method?: string | null): boolean {
  return !!method && INSTANT_METHODS.has(String(method).toLowerCase());
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
      amounts: { usd: args.amount },
      paymentMethod: args.paymentMethod,
      referenceNumber: args.referenceNumber || undefined,
    };
    const html = buildReceiptHtml(input);
    const blob = (await renderHtmlToPdf(html)).output("blob");
    const safeName = args.receiptNumber.replace(/[^A-Za-z0-9._-]/g, "_");
    const path = `receipts/${safeName}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("school-media")
      .upload(path, blob, { contentType: "application/pdf", upsert: true });
    if (upErr) { console.error("[receipt] upload failed", upErr); return null; }
    const { data: pub } = supabase.storage.from("school-media").getPublicUrl(path);
    const url = pub.publicUrl;

    const update: TablesUpdate<"payments"> = { receipt_url: url };
    if (args.autoVerify) {
      update.verified_at = new Date(args.paymentDate).toISOString();
      if (args.verifiedBy) update.verified_by = args.verifiedBy;
    }
    const { error: updErr } = await supabase.from("payments").update(update).eq("id", args.paymentId);
    if (updErr) console.error("[receipt] payment update failed", updErr);
    return url;
  } catch (e) {
    console.error("[receipt] generate failed", e);
    return null;
  }
}
