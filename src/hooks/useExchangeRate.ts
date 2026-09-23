// USD is the base currency; ZiG amounts are derived from the bursar-managed
// USD → ZiG rate stored in the exchange_rates table.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_USD_TO_ZIG,
  getZigRate,
  setZigRate,
  subscribeZigRate,
} from "@/lib/currency";

export async function loadActiveZigRate(): Promise<number> {
  const { data } = await supabase
    .from("exchange_rates")
    .select("usd_to_zwg")
    .eq("is_active", true)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const r = Number(data?.usd_to_zwg);
  if (Number.isFinite(r) && r > 0) setZigRate(r);
  return getZigRate();
}

export function useExchangeRate() {
  const [rate, setRate] = useState<number>(getZigRate() || DEFAULT_USD_TO_ZIG);
  const [loading, setLoading] = useState(true);

  const fetchRate = useCallback(async () => {
    setLoading(true);
    const r = await loadActiveZigRate();
    setRate(r);
    setLoading(false);
    return r;
  }, []);

  useEffect(() => {
    fetchRate();
    const unsub = subscribeZigRate((r) => setRate(r));
    const ch = supabase
      .channel(`exchange-rates-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "exchange_rates" }, () => fetchRate())
      .subscribe();
    return () => {
      unsub();
      supabase.removeChannel(ch);
    };
  }, [fetchRate]);

  const updateRate = async (newRate: number) => {
    const r = Number(newRate);
    if (!Number.isFinite(r) || r <= 0) return;
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("exchange_rates").update({ is_active: false }).eq("is_active", true);
    await supabase.from("exchange_rates").insert({
      usd_to_zwg: r,
      source: "manual",
      is_active: true,
      set_by_admin: userData?.user?.id ?? null,
    });
    setZigRate(r);
    setRate(r);
  };

  const usdToZig = (v: number) => Number(v || 0) * rate;
  const zigToUsd = (v: number) => Number(v || 0) / (rate || 1);

  return { rate, loading, updateRate, usdToZig, zigToUsd, refetch: fetchRate };
}
