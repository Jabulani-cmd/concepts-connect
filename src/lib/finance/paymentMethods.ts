import type { Enums } from "@/integrations/supabase/types";

export type PaymentMethod = Enums<"payment_method">;

const LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  ecocash: "EcoCash",
  onemoney: "OneMoney",
  telecash: "Telecash",
  bank_transfer: "Bank Transfer (RTGS)",
  eft: "Internet Banking (ZIPIT)",
  card: "Card / Swipe (POS)",
  visa_mastercard: "Visa / Mastercard",
  paynow_web: "Paynow",
  manual: "Manual Entry",
  // Legacy values kept only so older records still display.
  snapscan: "SnapScan",
  zapper: "Zapper",
};

/** Methods a bursar or finance clerk can record at the school office. */
export const OFFICE_PAYMENT_METHODS: PaymentMethod[] = [
  "cash",
  "ecocash",
  "onemoney",
  "telecash",
  "bank_transfer",
  "eft",
  "card",
];

export function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "-";
  return LABELS[method as PaymentMethod] ?? method;
}
