import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** HTML-escape a value to prevent XSS when injecting into template strings */
export function safeHtml(s: any): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Replaces empty-string values with null, e.g. so optional date columns are not sent as "". */
export function emptyToNull<T extends Record<string, unknown>>(obj: T): { [K in keyof T]: T[K] extends string ? T[K] | null : T[K] } {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v === "" ? null : v])) as {
    [K in keyof T]: T[K] extends string ? T[K] | null : T[K];
  };
}
