import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandshakeIcon, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export default function SchoolLife() {
  const { t } = useTranslation();
  const [meetings, setMeetings] = useState<Tables<"meetings">[]>([]);
  const [galleryImages, setGalleryImages] = useState<{ id: string; image_url: string; caption: string | null }[]>([]);

  useEffect(() => {
    supabase.from("meetings").select("*").order("meeting_date", { ascending: true })
      .then(({ data }) => { if (data) setMeetings(data); });
    supabase.from("gallery_images").select("id, image_url, caption").eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setGalleryImages(data); });
  }, []);

  const sdcMeetings = meetings.filter(m => m.meeting_type === "sdc");
  const ptMeetings = meetings.filter(m => m.meeting_type === "parent-teacher");

  return (
    <Layout>
      <section className="bg-secondary py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-secondary-foreground">
            {t("schoolLife.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container">
          <Tabs defaultValue="sdc">
            <TabsList className="mb-8 flex-wrap">
              <TabsTrigger value="sdc"><HandshakeIcon className="mr-1 h-4 w-4" /> {t("schoolLife.tabs.sdc")}</TabsTrigger>
              <TabsTrigger value="pt-meetings"><Calendar className="mr-1 h-4 w-4" /> {t("schoolLife.tabs.pt")}</TabsTrigger>
              <TabsTrigger value="gallery">{t("schoolLife.tabs.gallery")}</TabsTrigger>
            </TabsList>

            <TabsContent value="sdc">
              <div className="mb-6">
                <h2 className="font-heading text-2xl font-bold text-primary mb-2">{t("schoolLife.sdc.title")}</h2>
                <p className="text-muted-foreground">{t("schoolLife.sdc.body")}</p>
              </div>
              {sdcMeetings.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {sdcMeetings.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                      <Card className="h-full transition-shadow hover:shadow-maroon">
                        <CardContent className="p-5">
                          <span className="inline-block rounded-full bg-maroon-light px-2 py-0.5 text-xs font-semibold text-primary mb-2">{t("schoolLife.sdc.badge")}</span>
                          <h3 className="font-heading font-semibold">{m.title}</h3>
                          <p className="text-sm text-accent font-medium">{new Date(m.meeting_date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                          {m.location && <p className="text-xs text-muted-foreground mt-1">📍 {m.location}</p>}
                          {m.description && <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground italic py-8">{t("schoolLife.sdc.empty")}</p>
              )}
            </TabsContent>

            <TabsContent value="pt-meetings">
              <div className="mb-6">
                <h2 className="font-heading text-2xl font-bold text-primary mb-2">{t("schoolLife.pt.title")}</h2>
                <p className="text-muted-foreground">{t("schoolLife.pt.body")}</p>
              </div>
              {ptMeetings.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {ptMeetings.map((m, i) => (
                    <motion.div key={m.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                      <Card className="h-full transition-shadow hover:shadow-maroon">
                        <CardContent className="p-5">
                          <span className="inline-block rounded-full bg-maroon-light px-2 py-0.5 text-xs font-semibold text-primary mb-2">{t("schoolLife.pt.badge")}</span>
                          <h3 className="font-heading font-semibold">{m.title}</h3>
                          <p className="text-sm text-accent font-medium">{new Date(m.meeting_date).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                          {m.location && <p className="text-xs text-muted-foreground mt-1">📍 {m.location}</p>}
                          {m.description && <p className="mt-2 text-sm text-muted-foreground">{m.description}</p>}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground italic py-8">{t("schoolLife.pt.empty")}</p>
              )}
            </TabsContent>

            <TabsContent value="gallery">
              {galleryImages.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {galleryImages.map((img, i) => (
                    <motion.div key={img.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                      <img src={img.image_url} alt={img.caption || `Gallery ${i + 1}`} className="h-64 w-full rounded-xl object-cover shadow-maroon transition-transform hover:scale-[1.02]" />
                      {img.caption && <p className="mt-2 text-center text-xs text-muted-foreground">{img.caption}</p>}
                    </motion.div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground italic py-8">{t("schoolLife.galleryEmpty")}</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}
