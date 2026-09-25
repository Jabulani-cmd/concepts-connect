import { formatUSD, formatZiG } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface Props {
  usd: number | string | null | undefined;
  /** Text after the amount, e.g. "owing" or "credit". */
  suffix?: string;
  className?: string;
  /** Show ZiG on the same line (for compact rows) instead of underneath. */
  inline?: boolean;
}

/**
 * An amount in US$ with its ZiG equivalent. Neither figure ever wraps mid-number: by
 * default ZiG sits in smaller text underneath, which keeps headline amounts tidy on phones.
 */
export default function Money({ usd, suffix, className, inline = false }: Props) {
  return (
    <span className={cn(inline ? "inline-flex flex-wrap items-baseline gap-x-1" : "inline-flex flex-col", className)}>
      <span className="whitespace-nowrap">
        {formatUSD(usd)}
        {suffix ? ` ${suffix}` : ""}
      </span>
      <span className={cn("whitespace-nowrap font-normal opacity-70", inline ? "text-[0.85em]" : "text-[0.6em] leading-tight")}>
        {inline ? `(${formatZiG(usd)})` : formatZiG(usd)}
      </span>
    </span>
  );
}
