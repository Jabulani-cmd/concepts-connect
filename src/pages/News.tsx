import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";


const newsItems = [
  {
    id: 1, title: "Term 1 Examination Results Published", date: "Feb 28, 2026",
    excerpt: "Form 4 and Upper Sixth results are now available on the student portal.",
    body: "We are pleased to announce that Term 1 examination results for Form 4 and Upper Sixth students have been published on the student portal. Students can log in to view their individual results. Parents are encouraged to contact the school for any queries. The overall pass rate was 95%, with 142 students achieving distinctions across all subjects.",
  },
  {
    id: 2, title: "Inter-house Athletics Day", date: "Mar 15, 2026",
    excerpt: "Annual athletics day at the school stadium. All parents welcome.",
    body: "The annual Inter-house Athletics Day will take place on Saturday, 15 March 2026 at the MavingTech Stadium. Events include sprints, long-distance, relays, field events, and the prestigious house war cry competition. Gates open at 7:30 AM. Refreshments will be available. All parents and guardians are warmly invited to attend and support their house.",
  },
  {
    id: 3, title: "Open Day for Prospective Students", date: "Apr 5, 2026",
    excerpt: "Tour our campus and meet our teachers. Register online now.",
    body: "MavingTech High School invites prospective students and their families to our annual Open Day on Saturday, 5 April 2026. The programme includes campus tours, subject demonstrations, meet-and-greet with teachers, and a Q&A session with the headmaster. Pre-registration is recommended via the admissions page.",
  },
  {
    id: 4, title: "Science Olympiad Team Wins Silver", date: "Feb 10, 2026",
    excerpt: "Our science team placed second at the National Science Olympiad.",
    body: "Congratulations to our Science Olympiad team for winning the silver medal at the 2026 National Science Olympiad held in Bulawayo. The team of six students, led by Mr. Chikore, competed against 48 schools from across Zimbabwe. Special mention goes to Tatenda Mpofu (Upper Sixth) who was individually recognised as the top chemistry contestant.",
  },
  {
    id: 5, title: "New Computer Lab Inauguration", date: "Jan 20, 2026",
    excerpt: "State-of-the-art computer lab with 40 workstations now operational.",
    body: "The school has inaugurated a new computer laboratory equipped with 40 modern workstations, high-speed internet, and the latest software for Computer Science and ICT classes. The lab was made possible through generous donations from the Old MavingTech alumni Association and corporate sponsors. It will serve students from Form 1 to Upper Sixth.",
  },
];

export default function News() {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = newsItems.find((n) => n.id === selectedId);

  return (
    <Layout>
      <section className="bg-secondary py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-secondary-foreground">
            {t("news.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-3xl">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Button variant="ghost" onClick={() => setSelectedId(null)} className="mb-6 text-primary">
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t("news.back")}
                </Button>
                <article>
                  <span className="flex items-center gap-2 text-sm text-accent font-semibold">
                    <Calendar className="h-4 w-4" /> {selected.date}
                  </span>
                  <h2 className="mt-2 font-heading text-3xl font-bold text-primary">{selected.title}</h2>
                  <p className="mt-6 leading-relaxed text-muted-foreground">{selected.body}</p>
                </article>
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                {newsItems.map((n, i) => (
                  <motion.div key={n.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                    <Card
                      className="cursor-pointer transition-all hover:shadow-maroon hover:-translate-y-0.5"
                      onClick={() => setSelectedId(n.id)}
                    >
                      <CardContent className="p-6">
                        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                          <Calendar className="h-3 w-3" /> {n.date}
                        </span>
                        <h3 className="mt-2 font-heading text-lg font-semibold">{n.title}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">{n.excerpt}</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    </Layout>
  );
}
