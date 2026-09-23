import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";
import Layout from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.12, duration: 0.5 } }),
};

export default function SchoolProjects() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    supabase.from("school_projects").select("*").eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setProjects(data); });
  }, []);

  return (
    <Layout>
      <section className="bg-section-warm py-16">
        <div className="container text-center">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-foreground md:text-5xl">
            {t("projectsPage.title")}
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {t("projectsPage.subtitle")}
          </motion.p>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          {projects.length > 0 ? (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p, i) => (
                <motion.div key={p.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                  <Card className="h-full overflow-hidden border-none shadow-maroon transition-transform hover:-translate-y-1">
                    {p.image_url && (
                      <div className="aspect-video w-full overflow-hidden">
                        <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      </div>
                    )}
                    <CardContent className="p-6">
                      <h3 className="font-heading text-lg font-semibold text-foreground">{p.name}</h3>
                      {p.description && (<p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>)}
                      <div className="mt-3 flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                        <Button size="sm" variant="secondary" className="gap-1" onClick={() => navigate(`/pay-online?type=donation&project=${p.id}`)}>
                          <Heart className="h-3 w-3" /> {t("projectsPage.donate")}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground italic">{t("projectsPage.empty")}</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
