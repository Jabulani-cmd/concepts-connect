/**
 * Zimbabwean secondary school levels: Forms 1–4 lead to ZIMSEC O-Level,
 * Forms 5–6 (Lower and Upper Sixth) lead to A-Level.
 */
export const FORM_LEVELS: readonly string[] = ["Form 1", "Form 2", "Form 3", "Form 4", "Form 5", "Form 6"];

export const DEFAULT_FORM = FORM_LEVELS[0];

/** "Form 5" → "Form 5 (Lower Sixth)"; other forms are returned unchanged. */
export function formLabel(form: string): string {
  if (form === "Form 5") return "Form 5 (Lower Sixth)";
  if (form === "Form 6") return "Form 6 (Upper Sixth)";
  return form;
}
