import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { downloadFile } from "@/lib/download";

export default function Downloads() {
  const { t } = useTranslation();
  const [downloads, setDownloads] = useState<Tables<"downloads">[]>([]);
  // ?category=fees opens the page on one category, e.g. from the School Fees page.
  const [params] = useSearchParams();
  const [filter, setFilter] = useState(params.get("category") || "all");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("downloads").select("*").order("created_at", { ascending: false });
      if (data) setDownloads(data);
    };
    fetch();
  }, []);

  const categoryLabel = (c: string) => c === "all" ? t("common.all") : t(`downloads.categories.${c}`, { defaultValue: c });
  const filtered = filter === "all" ? downloads : downloads.filter(d => d.category === filter);
  const categories = ["all", ...Array.from(new Set(downloads.map(d => d.category)))];

  return (
    <Layout>
      <section className="bg-maroon-gradient py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-white">
            {t("downloads.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="mb-8 flex flex-wrap gap-2">
            {categories.map(c => (
              <Button key={c} variant={filter === c ? "default" : "outline"} size="sm" onClick={() => setFilter(c)}>
                {categoryLabel(c)}
              </Button>
            ))}
          </div>

          {filtered.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((d, i) => (
                <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <Card className="h-full transition-shadow hover:shadow-maroon">
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-light">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-heading font-semibold">{d.title}</h3>
                        {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                        <span className="mt-1 inline-block text-xs text-accent">{categoryLabel(d.category)}</span>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label={t("downloads.view")}>
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("downloads.download")} disabled={saving === d.id}
                          onClick={async () => { setSaving(d.id); await downloadFile(d.file_url, d.title); setSaving(null); }}>
                          {saving === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground italic">{t("downloads.empty")}</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
