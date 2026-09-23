import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

type FacilityImage = {
  id: string;
  image_url: string;
  caption: string | null;
  facility_type: string;
};

const facilityTypeKeys = ["boarding","classrooms","sports","labs","library","clubs","ict","dining","assembly","general"];

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

export default function Facilities() {
  const { t } = useTranslation();
  const [images, setImages] = useState<FacilityImage[]>([]);

  useEffect(() => {
    supabase.from("facility_images").select("id, image_url, caption, facility_type").eq("is_active", true).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setImages(data); });
  }, []);

  const facilityTypes = facilityTypeKeys.map(k => ({ value: k, label: t(`facilities.types.${k}`) }));
  const typesWithImages = facilityTypes.filter(ft => images.some(img => img.facility_type === ft.value));

  const lifeItems = [
    { key: "boarding" }, { key: "dining" }, { key: "sports" }, { key: "labs" }, { key: "ict" }, { key: "library" }, { key: "clubs" }, { key: "assembly" }, { key: "general" }
  ];

  return (
    <Layout>
      <section className="bg-secondary py-16">
        <div className="container">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="font-heading text-4xl font-bold text-secondary-foreground">
            {t("facilities.title")}
          </motion.h1>
        </div>
      </section>

      <section className="py-12">
        <div className="container max-w-3xl text-center">
          <motion.p initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-lg leading-relaxed text-muted-foreground">
            {t("facilities.intro")}
          </motion.p>
        </div>
      </section>

      <section className="bg-section-warm py-16">
        <div className="container">
          {typesWithImages.length > 0 ? (
            <Tabs defaultValue={typesWithImages[0]?.value || "boarding"} className="space-y-8">
              <TabsList className="flex flex-wrap justify-center">
                <TabsTrigger value="all">{t("common.all")}</TabsTrigger>
                {typesWithImages.map(ft => (<TabsTrigger key={ft.value} value={ft.value}>{ft.label}</TabsTrigger>))}
              </TabsList>
              <TabsContent value="all"><FacilityGrid images={images} /></TabsContent>
              {typesWithImages.map(ft => (
                <TabsContent key={ft.value} value={ft.value}>
                  <FacilityGrid images={images.filter(img => img.facility_type === ft.value)} />
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <p className="text-center text-muted-foreground italic py-8">{t("facilities.empty")}</p>
          )}
        </div>
      </section>

      <section className="py-16">
        <div className="container max-w-4xl">
          <h2 className="mb-8 text-center font-heading text-3xl font-bold text-primary">{t("facilities.lifeTitle")}</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {lifeItems.map((item, i) => (
              <motion.div key={item.key} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="h-full border-none shadow-maroon">
                  <CardContent className="p-6">
                    <h3 className="font-heading text-lg font-semibold text-primary">{t(`facilities.types.${item.key}`)}</h3>
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

function FacilityGrid({ images }: { images: FacilityImage[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {images.map((img, i) => (
        <motion.div key={img.id} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
          <div className="overflow-hidden rounded-xl shadow-maroon">
            <img src={img.image_url} alt={img.caption || "Facility"} className="h-56 w-full object-cover transition-transform hover:scale-105" />
          </div>
          {img.caption && <p className="mt-2 text-center text-xs text-muted-foreground">{img.caption}</p>}
        </motion.div>
      ))}
    </div>
  );
}
