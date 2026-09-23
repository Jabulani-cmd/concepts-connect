import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ApprovalRequest = Tables<"finance_approval_requests">;

export const approvalTypeLabels: Record<string, string> = {
  delete_fee_structure: "Delete Fee Structure",
  delete_expense: "Delete Expense",
  delete_petty_cash: "Delete Petty Cash Entry",
  delete_supplier_invoice: "Delete Supplier Invoice",
  void_invoice: "Void Invoice",
  void_payment: "Void Payment",
};

// Tables a finance clerk may request a record deletion from.
const DELETABLE_TABLES = ["fee_structures", "expenses", "petty_cash", "supplier_invoices"] as const;
type DeletableTable = (typeof DELETABLE_TABLES)[number];

const isDeletableTable = (t: string | null): t is DeletableTable =>
  DELETABLE_TABLES.includes(t as DeletableTable);

/**
 * Carries out the action behind an approved finance request.
 * Returns a short summary for the reviewer, or throws on failure.
 */
export async function executeApprovedRequest(request: ApprovalRequest): Promise<string> {
  const { request_type, target_table, target_id } = request;
  if (!target_id) throw new Error("Request has no target record");

  if (request_type.startsWith("delete_")) {
    if (!isDeletableTable(target_table)) {
      throw new Error(`Deleting from "${target_table}" is not permitted`);
    }
    if (target_table === "fee_structures") {
      await supabase.from("invoice_items").update({ fee_structure_id: null }).eq("fee_structure_id", target_id);
    }
    const { error } = await supabase.from(target_table).delete().eq("id", target_id);
    if (error) throw error;
    return `The ${target_table.replace(/_/g, " ")} record has been deleted.`;
  }

  if (request_type === "void_invoice") {
    const { error } = await supabase.from("invoices").update({ status: "voided" }).eq("id", target_id);
    if (error) throw error;
    return "Invoice voided.";
  }

  if (request_type === "void_payment") {
    // Invoice totals are synchronised automatically by backend payment triggers.
    const { error } = await supabase.from("payments").delete().eq("id", target_id);
    if (error) throw error;
    return "Payment voided and reversed.";
  }

  throw new Error(`Unknown request type "${request_type}"`);
}
