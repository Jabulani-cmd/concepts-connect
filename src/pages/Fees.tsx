import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileText, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Fees() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("downloads")
      .select("*")
      .eq("category", "fees")
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDocs(data); });
  }, []);

  return (
    <Layout>
      <section className="bg-secondary py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-secondary-foreground">
            {t("fees.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-4xl">
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-4 text-center text-lg text-muted-foreground">
            {t("fees.intro")}
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-8 flex justify-center">
            <Button size="lg" className="gap-2" onClick={() => navigate("/pay-online?type=fees")}>
              <CreditCard className="h-5 w-5" /> {t("fees.payOnline")}
            </Button>
          </motion.div>

          {docs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {docs.map((d, i) => (
                <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <Card className="h-full transition-shadow hover:shadow-maroon">
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-light">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-heading font-semibold">{d.title}</h3>
                        {d.description && <p className="mt-1 text-sm text-muted-foreground">{d.description}</p>}
                      </div>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
                      </a>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground italic py-8">{t("fees.empty")}</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
