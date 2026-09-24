// Generic helper that wraps any DOM HTML snippet into a fully-branded printable
// document with the school logo, name and motto in the header. Used by the
// PrintableSection component to expose view / print / download actions for
// every section of the parent and student portals (grades, marks, timetables,
// term reports, attendance, announcements, etc.).
import {
  SCHOOL_LOGO_URL,
  SCHOOL_NAME,
  SCHOOL_MOTTO,
} from "@/lib/finance/pdf";
import { SCHOOL_ADDRESS, SCHOOL_CONTACT_LINE, SCHOOL_PHONE_EMAIL_LINE } from "@/lib/school";

export interface BrandedDocOptions {
  title: string;
  subtitle?: string;
  bodyHtml: string;
}

export function buildBrandedHtml({ title, subtitle, bodyHtml }: BrandedDocOptions): string {
  const dateStr = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; margin: 0; padding: 32px; max-width: 1000px; margin: 0 auto; }
  .doc-header { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #0f4c5c; padding-bottom: 16px; margin-bottom: 20px; }
  .doc-header img { height: 72px; width: auto; }
  .doc-header .school { flex: 1; }
  .doc-header h1 { font-size: 20px; color: #0f4c5c; margin: 0; }
  .doc-header .motto { font-size: 12px; color: #555; margin-top: 2px; font-style: italic; }
  .doc-header .contact { font-size: 11px; color: #666; margin-top: 4px; }
  .doc-title { margin: 16px 0 8px; }
  .doc-title h2 { font-size: 18px; color: #1e3a5f; margin: 0; }
  .doc-title .sub { font-size: 13px; color: #666; margin-top: 2px; }
  .doc-meta { font-size: 11px; color: #888; margin-bottom: 16px; }
  .doc-body { font-size: 13px; line-height: 1.5; }
  .doc-body table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; }
  .doc-body th, .doc-body td { border: 1px solid #d0d7de; padding: 6px 8px; text-align: left; font-size: 12px; vertical-align: top; }
  .doc-body th { background: #f1f5f9; font-weight: 600; }
  .doc-body button, .doc-body [data-print-hide], .doc-body .no-print { display: none !important; }
  .doc-body svg { max-width: 100%; height: auto; }
  .doc-body img { max-width: 100%; height: auto; }
  .doc-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #d0d7de; font-size: 10px; color: #888; text-align: center; }
  @media print {
    body { padding: 16px; }
    .doc-header { break-inside: avoid; }
  }
</style></head><body>
<div class="doc-header">
  <img src="${SCHOOL_LOGO_URL}" alt="${escapeHtml(SCHOOL_NAME)} logo" onerror="this.style.display='none'" />
  <div class="school">
    <h1>${escapeHtml(SCHOOL_NAME)}</h1>
    <div class="motto">${escapeHtml(SCHOOL_MOTTO)}</div>
    <div class="contact">${escapeHtml(SCHOOL_ADDRESS)}<br/>${escapeHtml(SCHOOL_PHONE_EMAIL_LINE)}</div>
  </div>
</div>
<div class="doc-title">
  <h2>${escapeHtml(title)}</h2>
  ${subtitle ? `<div class="sub">${escapeHtml(subtitle)}</div>` : ""}
</div>
<div class="doc-meta">Generated ${dateStr}</div>
<div class="doc-body">${bodyHtml}</div>
<div class="doc-footer">${escapeHtml(SCHOOL_NAME)} · ${escapeHtml(SCHOOL_CONTACT_LINE)} · Official portal document</div>
</body></html>`;
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function safeFileName(s: string): string {
  return (s || "document").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "document";
}
