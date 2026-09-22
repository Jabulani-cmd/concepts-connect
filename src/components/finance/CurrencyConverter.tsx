import { useMemo, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatUSD } from "@/lib/currency";

interface CurrencyConverterProps {
  compact?: boolean;
  initialUsd?: number;
}

export default function CurrencyConverter({ compact = false, initialUsd = 1 }: CurrencyConverterProps) {
  const { rate, usdToZig, zigToUsd } = useExchangeRate();
  const [usd, setUsd] = useState(String(initialUsd));
  const [zig, setZig] = useState(() => (initialUsd * rate).toFixed(2));

  const rateLabel = useMemo(
    () => `US$ 1 = ZiG ${Number(rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`,
    [rate],
  );

  const updateUsd = (value: string) => {
    setUsd(value);
    const amount = Number(value);
    setZig(Number.isFinite(amount) ? usdToZig(amount).toFixed(2) : "");
  };

  const updateZig = (value: string) => {
    setZig(value);
    const amount = Number(value);
    setUsd(Number.isFinite(amount) ? zigToUsd(amount).toFixed(2) : "");
  };

  const content = (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <ArrowRightLeft className="h-4 w-4 text-accent" /> Currency converter
        </div>
        <span className="text-xs text-muted-foreground">{rateLabel}</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="converter-usd">US dollars</Label>
          <Input id="converter-usd" type="number" min="0" step="0.01" value={usd} onChange={(event) => updateUsd(event.target.value)} />
        </div>
        <ArrowRightLeft className="mb-3 h-4 w-4 text-muted-foreground" />
        <div className="space-y-1">
          <Label htmlFor="converter-zig">ZiG</Label>
          <Input id="converter-zig" type="number" min="0" step="0.01" value={zig} onChange={(event) => updateZig(event.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{formatUSD(Number(usd) || 0)} is ZiG {Number(zig || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.</p>
    </div>
  );

  if (compact) return content;
  return <Card><CardContent className="p-5">{content}</CardContent></Card>;
}