import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, CreditCard, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { downloadFile } from "@/lib/download";

type Doc = Tables<"downloads">;

export default function Fees() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("downloads")
      .select("*")
      .eq("category", "fees")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setDocs(data);
        setLoading(false);
      });
  }, []);

  const download = async (d: Doc) => {
    setSaving(d.id);
    await downloadFile(d.file_url, d.title);
    setSaving(null);
  };

  const [current, ...earlier] = docs;
  const updated = current ? new Date(current.created_at).toLocaleDateString(i18n.language === "en" ? "en-GB" : i18n.language, { day: "numeric", month: "long", year: "numeric" }) : "";

  return (
    <Layout>
      <section className="bg-maroon-gradient py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-white">
            {t("fees.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container max-w-4xl">
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8 text-center text-lg text-muted-foreground">
            {t("fees.intro")}
          </motion.p>

          {loading ? (
            <div className="h-48 animate-pulse rounded-xl bg-muted" />
          ) : current ? (
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <Card className="overflow-hidden border-2 border-primary/25 shadow-maroon">
                <div className="bg-maroon-gradient px-6 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/90">{t("fees.currentLabel")}</div>
                <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-8 w-8 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="font-heading text-2xl font-bold">{current.title}</h2>
                    {current.description && <p className="mt-1 text-sm text-muted-foreground">{current.description}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">{t("fees.updated", { date: updated })}</p>
                  </div>
                </CardContent>
                <div className="grid gap-2 border-t bg-muted/30 p-4 sm:grid-cols-2 sm:px-6">
                  <Button asChild size="lg" variant="outline" className="gap-2">
                    <a href={current.file_url} target="_blank" rel="noopener noreferrer">
                      <Eye className="h-5 w-5" /> {t("fees.view")}
                    </a>
                  </Button>
                  <Button size="lg" className="gap-2" onClick={() => download(current)} disabled={saving === current.id}>
                    {saving === current.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />} {t("fees.download")}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                <FileText className="h-10 w-10 text-primary/40" />
                <p className="text-muted-foreground">{t("fees.empty")}</p>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 flex flex-col items-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">{t("fees.payPrompt")}</p>
            <Button size="lg" variant={current ? "secondary" : "default"} className="gap-2" onClick={() => navigate("/pay-online?type=fees")}>
              <CreditCard className="h-5 w-5" /> {t("fees.payOnline")}
            </Button>
          </div>

          {current && (
            <p className="mt-6 text-center text-sm">
              <Link to="/downloads?category=fees" className="text-primary hover:underline">{t("fees.allDocuments")}</Link>
            </p>
          )}

          {earlier.length > 0 && (
            <div className="mt-12">
              <h3 className="mb-4 font-heading text-lg font-semibold">{t("fees.earlier")}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {earlier.map((d) => (
                  <Card key={d.id} className="h-full transition-shadow hover:shadow-maroon">
                    <CardContent className="flex items-start gap-4 p-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-semibold leading-tight">{d.title}</p>
                        {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label={t("fees.view")}>
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4" /></a>
                        </Button>
                        <Button variant="ghost" size="icon" aria-label={t("fees.download")} onClick={() => download(d)} disabled={saving === d.id}>
                          {saving === d.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
