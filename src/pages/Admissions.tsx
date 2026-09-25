import { useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import PageHero from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, FileText, Users, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import hero from "@/assets/hero-students-4.jpg";
import { FORM_LEVELS } from "@/lib/forms";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.6 } }),
};

export default function Admissions() {
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const steps = [
    { icon: FileText, title: t("admissions.steps.apply.title"), desc: t("admissions.steps.apply.desc") },
    { icon: Calendar, title: t("admissions.steps.assess.title"), desc: t("admissions.steps.assess.desc") },
    { icon: Users, title: t("admissions.steps.interview.title"), desc: t("admissions.steps.interview.desc") },
    { icon: CheckCircle, title: t("admissions.steps.accept.title"), desc: t("admissions.steps.accept.desc") },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    toast({ title: t("admissions.form.submittedToast"), description: t("admissions.form.submittedToastDesc") });
  };

  return (
    <Layout>
      <PageHero eyebrow={t("admissions.eyebrow")} title={t("admissions.title")} subtitle={t("admissions.subtitle")} image={hero} />

      <section className="py-20 md:py-28">
        <div className="container">
          <div className="mb-14 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("admissions.processEyebrow")}</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-primary md:text-5xl">{t("admissions.processTitle")}</h2>
            <div className="mx-auto mt-4 h-[3px] w-12 bg-primary" />
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <motion.div key={s.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="relative rounded-lg bg-card p-6 shadow-sm ring-1 ring-border/60">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <s.icon className="h-6 w-6 text-primary" />
                </div>
                <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("admissions.stepLabel")} {i + 1}</p>
                <h3 className="mt-2 font-heading text-lg font-bold text-purple-900 dark:text-purple-200">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-20 md:py-28">
        <div className="container max-w-2xl">
          <div className="mb-10 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("admissions.form.eyebrow")}</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-primary md:text-4xl">{t("admissions.form.title")}</h2>
            <div className="mx-auto mt-4 h-[3px] w-12 bg-primary" />
          </div>
          <div className="rounded-lg bg-card p-8 shadow-sm ring-1 ring-border/60 md:p-10">
            {submitted ? (
              <div className="py-12 text-center">
                <CheckCircle className="mx-auto mb-4 h-16 w-16 text-primary" />
                <h3 className="font-heading text-xl font-bold text-purple-900 dark:text-purple-200">{t("admissions.form.received")}</h3>
                <p className="mt-2 text-muted-foreground">{t("admissions.form.receivedBody")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t("admissions.form.firstName")} *</Label>
                    <Input id="firstName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t("admissions.form.lastName")} *</Label>
                    <Input id="lastName" required />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dob">{t("admissions.form.dob")} *</Label>
                    <Input id="dob" type="date" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade">{t("admissions.form.grade")} *</Label>
                    <Select required>
                      <SelectTrigger><SelectValue placeholder={t("admissions.form.gradePlaceholder")} /></SelectTrigger>
                      <SelectContent>
                        {FORM_LEVELS.map(g => (
                          <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prevSchool">{t("admissions.form.prevSchool")}</Label>
                  <Input id="prevSchool" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="parentName">{t("admissions.form.parentName")} *</Label>
                    <Input id="parentName" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="parentPhone">{t("admissions.form.parentPhone")} *</Label>
                    <Input id="parentPhone" type="tel" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parentEmail">{t("admissions.form.parentEmail")} *</Label>
                  <Input id="parentEmail" type="email" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">{t("admissions.form.notes")}</Label>
                  <Textarea id="notes" rows={3} />
                </div>
                <Button type="submit" size="lg" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {t("admissions.form.submit")}
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
