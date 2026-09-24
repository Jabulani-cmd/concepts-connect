import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AgentFinding = Tables<"agent_findings"> & {
  students?: { full_name: string; admission_number: string | null } | null;
  classes?: { name: string } | null;
};
export type AgentRun = Tables<"agent_runs">;
export type FindingKind = AgentFinding["kind"];
export type FindingStatus = "open" | "acknowledged" | "actioned" | "dismissed";

export const KIND_LABELS: Record<string, string> = {
  at_risk: "Learner needs support",
  attendance_not_taken: "Register not taken",
  marks_overdue: "Marks overdue",
  fee_arrears: "Fee arrears",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "New",
  acknowledged: "Seen",
  actioned: "Done",
  dismissed: "Dismissed",
};

export const FINDING_SELECT = "*, students(full_name, admission_number), classes(name)";

/** Runs the school monitoring agent now (school leaders and HODs). */
export async function runAgent(trigger: "manual" | "auto" = "manual") {
  const { data, error } = await supabase.functions.invoke("school-agent", { body: { trigger } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const body = ctx ? await ctx.clone().json().catch(() => null) : null;
    throw new Error(body?.error ?? error.message);
  }
  return data as { ok: boolean; already_running?: boolean; summary?: Record<string, number | boolean> };
}

/** Records a staff review. Dismissing needs a reason. */
export async function reviewFinding(id: string, status: FindingStatus, note?: string) {
  const { error } = await supabase.rpc("review_agent_finding", { _id: id, _status: status, _note: note ?? null });
  if (error) throw error;
}

/** Loads eight weeks of demo attendance, marks and homework for the demo school. */
export async function loadDemoActivity() {
  const { data, error } = await supabase.rpc("seed_demo_activity");
  if (error) throw error;
  return data as Record<string, number>;
}
