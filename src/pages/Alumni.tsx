import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";

const alumni = [
  { name: "Dr. Tinashe Mutasa", role: "Surgeon, Parirenyatwa Group of Hospitals", year: "Class of 1998" },
  { name: "Nokuthula Ndlovu", role: "Software Engineer, Google", year: "Class of 2005" },
  { name: "Mandla Khumalo", role: "Diplomat, United Nations", year: "Class of 2001" },
];

export default function Alumni() {
  const { t } = useTranslation();
  return (
    <Layout>
      <section className="bg-maroon-gradient py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-white">
            {t("alumni.title")}
          </motion.h1>
          <p className="mt-2 text-white/75">{t("alumni.subtitle")}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {alumni.map((a, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <Card className="transition-shadow hover:shadow-maroon">
                  <CardContent className="p-6">
                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-heading text-xl font-bold text-primary">
                      {a.name[0]}
                    </div>
                    <h3 className="font-heading text-lg font-semibold">{a.name}</h3>
                    <p className="text-sm text-muted-foreground">{a.role}</p>
                    <p className="mt-1 text-xs font-medium text-accent">{a.year}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}
