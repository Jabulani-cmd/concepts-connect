import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import PageHero from "@/components/layout/PageHero";
import { BookOpen, FlaskConical, Languages, Calculator, Palette, Laptop } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import achievementsImg from "@/assets/achievements.jpg";
import hero from "@/assets/academics-computers.jpg";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

export default function Academics() {
  const { t } = useTranslation();
  const subjects = [
    { icon: Calculator, name: t("academics.subjects.math.name"), desc: t("academics.subjects.math.desc") },
    { icon: FlaskConical, name: t("academics.subjects.sciences.name"), desc: t("academics.subjects.sciences.desc") },
    { icon: Languages, name: t("academics.subjects.languages.name"), desc: t("academics.subjects.languages.desc") },
    { icon: BookOpen, name: t("academics.subjects.humanities.name"), desc: t("academics.subjects.humanities.desc") },
    { icon: Laptop, name: t("academics.subjects.technical.name"), desc: t("academics.subjects.technical.desc") },
    { icon: Palette, name: t("academics.subjects.arts.name"), desc: t("academics.subjects.arts.desc") },
  ];
  const results = [
    { year: "2025", level: "ZIMSEC O-Level (Form 4)", rate: "95%", distinctions: 142 },
    { year: "2025", level: "ZIMSEC A-Level (Upper Sixth)", rate: "89%", distinctions: 67 },
    { year: "2024", level: "ZIMSEC O-Level (Form 4)", rate: "93%", distinctions: 128 },
    { year: "2024", level: "ZIMSEC A-Level (Upper Sixth)", rate: "87%", distinctions: 58 },
  ];

  return (
    <Layout>
      <PageHero eyebrow={t("academics.eyebrow")} title={t("academics.title")} subtitle={t("academics.subtitle")} image={hero} />

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="grid items-end gap-8 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("academics.programmesEyebrow")}</span>
              <h2 className="mt-3 font-heading text-3xl font-bold leading-tight text-foreground md:text-5xl">{t("academics.programmesTitle")}</h2>
              <div className="mt-5 h-[3px] w-12 bg-primary" />
            </motion.div>
            <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }} className="leading-relaxed text-muted-foreground">
              {t("academics.intro")}
            </motion.p>
          </div>

          <Tabs defaultValue="curriculum" className="mt-14">
            <TabsList className="mb-10">
              <TabsTrigger value="curriculum">{t("academics.tabs.curriculum")}</TabsTrigger>
              <TabsTrigger value="results">{t("academics.tabs.results")}</TabsTrigger>
            </TabsList>

            <TabsContent value="curriculum">
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {subjects.map((s, i) => (
                  <motion.div key={s.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                    className="group rounded-lg bg-card p-6 shadow-sm ring-1 ring-border/60 transition-shadow hover:shadow-lg">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
                      <s.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mt-4 font-heading text-lg font-bold text-foreground">{s.name}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="results">
              <div className="grid items-center gap-12 lg:grid-cols-2">
                <div>
                  <h3 className="font-heading text-2xl font-bold text-foreground">{t("academics.results.title")}</h3>
                  <div className="mt-4 h-[3px] w-12 bg-primary" />
                  <p className="mt-6 leading-relaxed text-muted-foreground">{t("academics.results.body")}</p>
                  <div className="mt-8 overflow-hidden rounded-lg ring-1 ring-border/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">{t("academics.results.year")}</th>
                          <th className="px-4 py-3 text-left font-semibold">{t("academics.results.level")}</th>
                          <th className="px-4 py-3 text-left font-semibold">{t("academics.results.passRate")}</th>
                          <th className="px-4 py-3 text-left font-semibold">{t("academics.results.distinctions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.map((r, i) => (
                          <tr key={i} className="border-t border-border/60">
                            <td className="px-4 py-3">{r.year}</td>
                            <td className="px-4 py-3">{r.level}</td>
                            <td className="px-4 py-3 font-semibold text-primary">{r.rate}</td>
                            <td className="px-4 py-3">{r.distinctions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <img src={achievementsImg} alt={t("academics.results.title")} className="rounded-lg shadow-lg" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}
