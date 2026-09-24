import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import Layout from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Music, BookOpen, Palette, Users, Volleyball } from "lucide-react";

const sportsKeys = ["rugby","soccer","athletics","swimming","cricket","netball"];
const clubDefs = [
  { key: "choir", icon: Music }, { key: "drama", icon: Palette }, { key: "debate", icon: BookOpen },
  { key: "community", icon: Users }, { key: "chess", icon: Volleyball }, { key: "science", icon: Trophy },
];

const sportsData: Record<string, { name: string; desc: string }> = {
  rugby: { name: "Rugby", desc: "Provincial champions 2024. U-16 and 1st XV teams." },
  soccer: { name: "Soccer", desc: "Boys and girls teams compete in the Inter-Schools League." },
  athletics: { name: "Athletics", desc: "Track & field, cross-country, and inter-house competitions." },
  swimming: { name: "Swimming", desc: "Annual galas and inter-school relay events." },
  cricket: { name: "Cricket", desc: "Boys 1st XI competing at provincial level." },
  netball: { name: "Netball", desc: "Girls teams representing at national level." },
};

const clubsData: Record<string, { name: string; desc: string }> = {
  choir: { name: "Choir & Music", desc: "Award-winning choir performing at national festivals." },
  drama: { name: "Drama Club", desc: "Annual productions and inter-school drama competitions." },
  debate: { name: "Debate Society", desc: "Critical thinking and public speaking development." },
  community: { name: "Community Service", desc: "Outreach programmes and environmental conservation." },
  chess: { name: "Chess Club", desc: "Strategic thinking: provincial finalists 2025." },
  science: { name: "Science Club", desc: "Hands-on experiments and science olympiads." },
};

export default function SportsCulture() {
  const { t } = useTranslation();
  return (
    <Layout>
      <section className="bg-gradient-to-b from-primary/5 to-background py-16">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 text-center">
            <h1 className="font-heading text-4xl font-bold text-primary md:text-5xl">{t("sportsCulture.title")}</h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">{t("sportsCulture.subtitle")}</p>
          </motion.div>

          <Tabs defaultValue="sports" className="w-full">
            <TabsList className="mx-auto mb-8 grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="sports">{t("sportsCulture.tabs.sports")}</TabsTrigger>
              <TabsTrigger value="culture">{t("sportsCulture.tabs.culture")}</TabsTrigger>
            </TabsList>

            <TabsContent value="sports">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {sportsKeys.map((k, i) => {
                  const s = sportsData[k];
                  return (
                    <motion.div key={k} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                      <Card className="h-full border-primary/10 transition-shadow hover:shadow-lg">
                        <CardContent className="p-6">
                          <h3 className="mb-2 text-lg font-semibold text-foreground">{s.name}</h3>
                          <p className="text-sm text-muted-foreground">{s.desc}</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="culture">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {clubDefs.map(({ key, icon: Icon }, i) => {
                  const c = clubsData[key];
                  return (
                    <motion.div key={key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                      <Card className="h-full border-primary/10 transition-shadow hover:shadow-lg">
                        <CardContent className="flex items-start gap-4 p-6">
                          <div className="rounded-full bg-primary/10 p-2"><Icon className="h-6 w-6 text-primary" /></div>
                          <div>
                            <h3 className="mb-1 text-lg font-semibold text-foreground">{c.name}</h3>
                            <p className="text-sm text-muted-foreground">{c.desc}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}
