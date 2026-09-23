import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export default function Vacancies() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Tables<"downloads">[]>([]);

  useEffect(() => {
    supabase.from("downloads").select("*").eq("category", "vacancies").order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDocs(data); });
  }, []);

  return (
    <Layout>
      <section className="bg-secondary py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-secondary-foreground">
            {t("vacancies.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-4xl">
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="mb-8 text-center text-lg text-muted-foreground">
            {t("vacancies.intro")}
          </motion.p>

          {docs.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {docs.map((d, i) => (
                <motion.div key={d.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}>
                  <Card className="h-full transition-shadow hover:shadow-maroon">
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-maroon-light">
                        <Briefcase className="h-5 w-5 text-primary" />
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
            <p className="text-center text-muted-foreground italic py-8">{t("vacancies.empty")}</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
