import en from "@/i18n/locales/en.json";
import sn from "@/i18n/locales/sn.json";
import nd from "@/i18n/locales/nd.json";

type Json = Record<string, unknown>;

function flatten(obj: Json, prefix = "", out: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v as Json, key, out);
  }
  return out;
}

const EN_FLAT = flatten(en as Json);
const TARGETS: Record<string, Record<string, string>> = {
  sn: flatten(sn as Json),
  nd: flatten(nd as Json),
};

const cache = new Map<string, Array<[string, string]>>();

/**
 * Builds an English-phrase -> target-language dictionary from the JSON
 * translation files, so hard-coded English copy that has no translation key
 * is still translated on screen. Entries are sorted longest-first so whole
 * phrases win over individual words.
 */
export function getPhraseDictionary(lang: string): Array<[string, string]> {
  const code = (lang || "").toLowerCase().slice(0, 2);
  const target = TARGETS[code];
  if (!target) return [];
  const cached = cache.get(code);
  if (cached) return cached;

  const map = new Map<string, string>();
  for (const [key, source] of Object.entries(EN_FLAT)) {
    const translated = target[key];
    if (!translated || translated === source) continue;
    if (source.trim().length < 3) continue;
    if (source.includes("{{")) continue;
    if (!map.has(source)) map.set(source, translated);
  }
  const entries = [...map.entries()].sort((a, b) => b[0].length - a[0].length);
  cache.set(code, entries);
  return entries;
}
