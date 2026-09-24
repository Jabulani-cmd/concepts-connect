import { DEMO_EMAIL_DOMAIN, DEMO_PASSWORDS } from "@/lib/demoAccounts";

/**
 * The published password of a demo account, or null for real accounts (whose
 * passwords are stored as one-way hashes and can never be read back).
 */
export function demoPasswordFor(email: string | null | undefined, role: string | null | undefined): string | null {
  const e = (email ?? "").toLowerCase();
  if (!e.endsWith(`@${DEMO_EMAIL_DOMAIN}`) && !e.endsWith(`.${DEMO_EMAIL_DOMAIN}`)) return null;
  return role && role in DEMO_PASSWORDS ? DEMO_PASSWORDS[role as keyof typeof DEMO_PASSWORDS] : null;
}

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghjkmnpqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%&*?";

/** A random 12-character password with upper and lower case letters, digits and a symbol (no look-alike characters). */
export function generatePassword(length = 12): string {
  const pick = (set: string) => {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    return set[n[0] % set.length];
  };
  const all = UPPER + LOWER + DIGITS + SYMBOLS;
  const chars = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(all));
  // Shuffle so the required characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const n = new Uint32Array(1);
    crypto.getRandomValues(n);
    const j = n[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
