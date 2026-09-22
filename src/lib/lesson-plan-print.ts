import { buildBrandedHtml } from "@/lib/print/printSection";
import { downloadHtmlDocument } from "@/lib/finance/print";

export interface LessonPlanPrintData {
  title: string;
  date: string;
  duration_minutes?: number | null;
  subjectName?: string;
  className?: string;
  objectives?: string | null;
  materials_needed?: string | null;
  introduction?: string | null;
  main_activity?: string | null;
  conclusion?: string | null;
  assessment_strategy?: string | null;
  homework_notes?: string | null;
  reflection?: string | null;
  status?: string;
}

export function buildLessonPlanHtml(plan: LessonPlanPrintData): string {
  const sections = [
    ["Learning Objectives", plan.objectives],
    ["Materials Needed", plan.materials_needed],
    ["Introduction / Warm-Up", plan.introduction],
    ["Main Activity / Body", plan.main_activity],
    ["Conclusion / Wrap-Up", plan.conclusion],
    ["Assessment Strategy", plan.assessment_strategy],
    ["Homework / Follow-Up", plan.homework_notes],
    ["Post-Lesson Reflection", plan.reflection],
  ].filter(([, v]) => v);

  const dateStr = new Date(plan.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const bodyHtml = `<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.6; }
  .header { border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
  .header h1 { font-size: 22px; color: #1e3a5f; margin-bottom: 6px; }
  .meta { display: flex; gap: 20px; flex-wrap: wrap; font-size: 13px; color: #555; }
  .meta span { background: #f0f4f8; padding: 3px 10px; border-radius: 4px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .badge-draft { background: #fef3c7; color: #92400e; }
  .badge-in_progress { background: #dbeafe; color: #1e40af; }
  .badge-completed { background: #d1fae5; color: #065f46; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 14px; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; border-left: 3px solid #2563eb; padding-left: 10px; }
  .section p { font-size: 14px; white-space: pre-wrap; word-wrap: break-word; }
  @media print { body { padding: 20px; } }
</style>
<div class="header">
  <h1>${escapeHtml(plan.title)}</h1>
  <div class="meta">
    <span>📅 ${dateStr}</span>
    ${plan.subjectName ? `<span>📘 ${escapeHtml(plan.subjectName)}</span>` : ""}
    ${plan.className ? `<span>🏫 ${escapeHtml(plan.className)}</span>` : ""}
    ${plan.duration_minutes ? `<span>⏱ ${plan.duration_minutes} min</span>` : ""}
    <span class="badge badge-${plan.status || "draft"}">${(plan.status || "draft").replace("_", " ")}</span>
  </div>
</div>
${sections.map(([label, value]) => `<div class="section"><h2>${label}</h2><p>${escapeHtml(value as string)}</p></div>`).join("\n")}`;
  return buildBrandedHtml({ title: "Lesson Plan", subtitle: plan.title, bodyHtml });
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function printLessonPlan(plan: LessonPlanPrintData) {
  const html = buildLessonPlanHtml(plan);
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
}

export async function downloadLessonPlan(plan: LessonPlanPrintData) {
  const html = buildLessonPlanHtml(plan);
  await downloadHtmlDocument(html, `${plan.title.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_")}_lesson_plan`);
}
