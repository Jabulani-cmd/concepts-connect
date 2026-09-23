import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import CurrencyConverter from "@/components/finance/CurrencyConverter";

/** Bursar-managed USD → ZiG rate. Every amount in the app follows this rate. */
export default function ExchangeRateCard() {
  const { toast } = useToast();
  const { rate, loading, updateRate } = useExchangeRate();
  const [value, setValue] = useState<string>(String(rate ?? ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!saving) setValue(String(rate ?? ""));
  }, [rate, saving]);

  const save = async () => {
    const r = Number(value);
    if (!Number.isFinite(r) || r <= 0) {
      toast({ title: "Invalid rate", description: "Enter a rate greater than zero.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await updateRate(r);
      toast({ title: "Exchange rate updated", description: `US$ 1 = ZiG ${r}. All amounts now use this rate.` });
    } catch (e: any) {
      toast({ title: "Could not update rate", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-none shadow-maroon">
      <CardContent className="grid gap-5 p-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.2fr)] lg:items-end">
        <div className="space-y-3">
          <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Exchange rate (US$ → ZiG)</Label>
          <p className="text-lg font-bold">
            US$ 1 = ZiG {loading ? "…" : Number(rate).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          </div>
          <div className="flex items-end gap-2">
          <Input
            type="number"
            step="0.0001"
            min="0"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-36"
          />
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            Update
          </Button>
          </div>
        </div>
        <CurrencyConverter compact />
      </CardContent>
    </Card>
  );
}
