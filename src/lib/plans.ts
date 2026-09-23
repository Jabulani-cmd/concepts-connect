import type { Tables } from "@/integrations/supabase/types";

/** subscription_plans.features is a JSON array of strings. */
export function planFeatures(plan: Pick<Tables<"subscription_plans">, "features">): string[] {
  return Array.isArray(plan.features) ? plan.features.filter((f): f is string => typeof f === "string") : [];
}
