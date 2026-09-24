// Currency: United States Dollar (USD) is the base currency; ZiG (Zimbabwe Gold)
// is shown alongside it using the bursar-managed exchange rate.
// Amounts are stored in USD in the *_usd columns. ZiG figures are derived.

export const CURRENCY_CODE = "USD";
export const CURRENCY_SYMBOL = "US$";
export const ZIG_CODE = "ZiG";
export const COUNTRY = "Zimbabwe";
export const CITY = "Harare";

export const DEFAULT_USD_TO_ZIG = 27;
const STORAGE_KEY = "mbs.usd_to_zig";

const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nfWhole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function readStoredRate(): number {
  try {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    if (Number.isFinite(v) && v > 0) return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_USD_TO_ZIG;
}

let zigRate = readStoredRate();
const listeners = new Set<(rate: number) => void>();

/** Current USD → ZiG rate. */
export function getZigRate(): number {
  return zigRate;
}

/** Update the USD → ZiG rate used by every formatter in the app. */
export function setZigRate(rate: number | string | null | undefined): void {
  const r = Number(rate);
  if (!Number.isFinite(r) || r <= 0 || r === zigRate) return;
  zigRate = r;
  try {
    localStorage.setItem(STORAGE_KEY, String(r));
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(r));
}

/** Subscribe to rate changes (returns an unsubscribe function). */
export function subscribeZigRate(fn: (rate: number) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const num = (amount: number | string | null | undefined) => {
  const n = Number(amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** `US$ 1,234.56` */
export function formatUSD(amount: number | string | null | undefined, opts?: { decimals?: boolean }): string {
  const n = num(amount);
  return `US$ ${opts?.decimals === false ? nfWhole.format(n) : nf.format(n)}`;
}

/** `ZiG 33,333.12` - takes a USD amount and converts it. */
export function formatZiG(amountUsd: number | string | null | undefined, opts?: { decimals?: boolean }): string {
  const n = num(amountUsd) * zigRate;
  return `${ZIG_CODE} ${opts?.decimals === false ? nfWhole.format(n) : nf.format(n)}`;
}

/** Dual display: `US$ 100.00 (ZiG 2,700.00)`. */
export function formatMoney(amountUsd: number | string | null | undefined, opts?: { decimals?: boolean }): string {
  return `${formatUSD(amountUsd, opts)} (${formatZiG(amountUsd, opts)})`;
}

/** Just the USD number, no symbol. */
export function fmtUSD(amount: number | string | null | undefined): string {
  return nf.format(num(amount));
}

/** Just the ZiG number, no code. */
export function fmtZiG(amountUsd: number | string | null | undefined): string {
  return nf.format(num(amountUsd) * zigRate);
}

export const usdToZig = (usd: number | string | null | undefined) => num(usd) * zigRate;
export const zigToUsd = (zig: number | string | null | undefined) => num(zig) / (zigRate || 1);
