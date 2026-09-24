import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Mail, Phone, MapPin, Clock, CalendarIcon, Send, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Layout from "@/components/layout/Layout";
import PageHero from "@/components/layout/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import hero from "@/assets/hero-students-5.jpg";
import { SCHOOL_ADDRESS, SCHOOL_EMAIL, SCHOOL_PHONE } from "@/lib/school";

const contactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(2000),
});
const appointmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(20).optional(),
  authority: z.string().min(1),
  department: z.string().optional(),
  preferred_date: z.date(),
  preferred_time: z.string().min(1),
  reason: z.string().trim().min(1).max(1000),
});

type ContactForm = z.infer<typeof contactSchema>;
type AppointmentForm = z.infer<typeof appointmentSchema>;

const authorities = [
  "Principal: Mrs. B. Dewa",
  "Deputy Principal",
  "Head of Department: Sciences",
  "Head of Department: Languages",
  "Head of Department: Humanities",
  "Head of Department: Commercials",
  "Senior Teacher",
  "Bursar / Finance",
  "Admissions Office",
];

const timeSlots = [
  "08:00 - 08:30", "08:30 - 09:00", "09:00 - 09:30", "09:30 - 10:00",
  "10:00 - 10:30", "10:30 - 11:00", "11:00 - 11:30", "11:30 - 12:00",
  "13:00 - 13:30", "13:30 - 14:00", "14:00 - 14:30", "14:30 - 15:00",
];

export default function Contact() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") === "appointment" ? "appointment" : "contact";
  const [contactSent, setContactSent] = useState(false);
  const [appointmentSent, setAppointmentSent] = useState(false);

  const contactForm = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });
  const appointmentForm = useForm<AppointmentForm>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: { name: "", email: "", phone: "", authority: "", department: "", reason: "", preferred_time: "" },
  });

  const onContactSubmit = async (data: ContactForm) => {
    const { error } = await supabase.from("contact_messages").insert({
      name: data.name, email: data.email, subject: data.subject || null, message: data.message,
    });
    if (error) toast({ title: t("common.error"), variant: "destructive" });
    else { setContactSent(true); contactForm.reset(); }
  };

  const onAppointmentSubmit = async (data: AppointmentForm) => {
    // Appointment requests arrive in the school's contact inbox; the office confirms by phone or email.
    const details = [
      `Appointment request with: ${data.authority}${data.department ? ` (${data.department})` : ""}`,
      `Preferred: ${format(data.preferred_date, "EEEE d MMMM yyyy")} at ${data.preferred_time}`,
      data.phone ? `Phone: ${data.phone}` : null,
      "",
      data.reason,
    ].filter((line) => line !== null).join("\n");
    const { error } = await supabase.from("contact_messages").insert({
      name: data.name,
      email: data.email,
      subject: `Appointment request: ${data.authority}`,
      message: details,
    });
    if (error) toast({ title: t("common.error"), variant: "destructive" });
    else { setAppointmentSent(true); appointmentForm.reset(); }
  };

  return (
    <Layout>
      <PageHero eyebrow={t("contact.eyebrow")} title={t("contact.title")} subtitle={t("contact.subtitle")} image={hero} />

      <section className="py-20 md:py-24">
        <div className="container">
          <div className="mb-14 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("contact.detailsEyebrow")}</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground md:text-5xl">{t("contact.detailsTitle")}</h2>
            <div className="mx-auto mt-4 h-[3px] w-12 bg-primary" />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: MapPin, title: t("contact.cards.address"), text: SCHOOL_ADDRESS },
              { icon: Phone, title: t("contact.cards.phone"), text: SCHOOL_PHONE },
              { icon: Mail, title: t("contact.cards.email"), text: SCHOOL_EMAIL },
              { icon: Clock, title: t("contact.cards.hours"), text: t("contact.cards.hoursText") },
            ].map((item, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.6 }}
                className="rounded-lg bg-card p-6 text-center shadow-sm ring-1 ring-border/60">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <item.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="font-heading text-base font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-muted/40 py-20 md:py-28">
        <div className="container max-w-4xl">
          <div className="mb-10 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{t("contact.formsEyebrow")}</span>
            <h2 className="mt-3 font-heading text-3xl font-bold text-foreground md:text-4xl">{t("contact.formsTitle")}</h2>
            <div className="mx-auto mt-4 h-[3px] w-12 bg-primary" />
          </div>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="contact">{t("contact.tabs.message")}</TabsTrigger>
              <TabsTrigger value="appointment">{t("contact.tabs.appointment")}</TabsTrigger>
            </TabsList>

            <TabsContent value="contact">
              <Card className="border-none shadow-maroon">
                <CardHeader><CardTitle className="font-heading">{t("contact.message.cardTitle")}</CardTitle></CardHeader>
                <CardContent>
                  {contactSent ? (
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                      <CheckCircle className="h-16 w-16 text-secondary" />
                      <h3 className="font-heading text-xl font-semibold">{t("contact.message.sent")}</h3>
                      <p className="text-muted-foreground">{t("contact.message.sentBody")}</p>
                      <Button onClick={() => setContactSent(false)} variant="outline">{t("common.sendAnother")}</Button>
                    </div>
                  ) : (
                    <Form {...contactForm}>
                      <form onSubmit={contactForm.handleSubmit(onContactSubmit)} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField control={contactForm.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>{t("contact.message.fullName")} *</FormLabel><FormControl><Input placeholder={t("contact.message.namePlaceholder")} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={contactForm.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>{t("contact.message.email")} *</FormLabel><FormControl><Input type="email" placeholder={t("contact.message.emailPlaceholder")} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={contactForm.control} name="subject" render={({ field }) => (
                          <FormItem><FormLabel>{t("contact.message.subject")}</FormLabel><FormControl><Input placeholder={t("contact.message.subjectPlaceholder")} {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={contactForm.control} name="message" render={({ field }) => (
                          <FormItem><FormLabel>{t("contact.message.message")} *</FormLabel><FormControl><Textarea placeholder={t("contact.message.messagePlaceholder")} className="min-h-[120px]" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" disabled={contactForm.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <Send className="mr-2 h-4 w-4" /> {contactForm.formState.isSubmitting ? t("common.sending") : t("contact.message.send")}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="appointment">
              <Card className="border-none shadow-maroon">
                <CardHeader>
                  <CardTitle className="font-heading">{t("contact.appointment.cardTitle")}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t("contact.appointment.cardSubtitle")}</p>
                </CardHeader>
                <CardContent>
                  {appointmentSent ? (
                    <div className="flex flex-col items-center gap-4 py-12 text-center">
                      <CheckCircle className="h-16 w-16 text-secondary" />
                      <h3 className="font-heading text-xl font-semibold">{t("contact.appointment.submitted")}</h3>
                      <p className="text-muted-foreground">{t("contact.appointment.submittedBody")}</p>
                      <Button onClick={() => setAppointmentSent(false)} variant="outline">{t("common.bookAnother")}</Button>
                    </div>
                  ) : (
                    <Form {...appointmentForm}>
                      <form onSubmit={appointmentForm.handleSubmit(onAppointmentSubmit)} className="space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField control={appointmentForm.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>{t("contact.message.fullName")} *</FormLabel><FormControl><Input placeholder={t("contact.message.namePlaceholder")} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={appointmentForm.control} name="email" render={({ field }) => (
                            <FormItem><FormLabel>{t("contact.message.email")} *</FormLabel><FormControl><Input type="email" placeholder={t("contact.message.emailPlaceholder")} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <FormField control={appointmentForm.control} name="phone" render={({ field }) => (
                          <FormItem><FormLabel>{t("contact.appointment.phone")}</FormLabel><FormControl><Input placeholder="+263..." {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField control={appointmentForm.control} name="authority" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("contact.appointment.authority")} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={t("contact.appointment.authorityPlaceholder")} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {authorities.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={appointmentForm.control} name="department" render={({ field }) => (
                            <FormItem><FormLabel>{t("contact.appointment.department")}</FormLabel><FormControl><Input placeholder={t("contact.appointment.departmentPlaceholder")} {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField control={appointmentForm.control} name="preferred_date" render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>{t("contact.appointment.date")} *</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button variant="outline" className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                      {field.value ? format(field.value, "PPP") : <span>{t("contact.appointment.pickDate")}</span>}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar mode="single" selected={field.value} onSelect={field.onChange}
                                    disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
                                    initialFocus className={cn("p-3 pointer-events-auto")} />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )} />
                          <FormField control={appointmentForm.control} name="preferred_time" render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("contact.appointment.time")} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder={t("contact.appointment.timePlaceholder")} /></SelectTrigger></FormControl>
                                <SelectContent>
                                  {timeSlots.map((tSlot) => <SelectItem key={tSlot} value={tSlot}>{tSlot}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )} />
                        </div>
                        <FormField control={appointmentForm.control} name="reason" render={({ field }) => (
                          <FormItem><FormLabel>{t("contact.appointment.reason")} *</FormLabel><FormControl><Textarea placeholder={t("contact.appointment.reasonPlaceholder")} className="min-h-[100px]" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button type="submit" disabled={appointmentForm.formState.isSubmitting} className="bg-primary text-primary-foreground hover:bg-primary/90">
                          <CalendarIcon className="mr-2 h-4 w-4" /> {appointmentForm.formState.isSubmitting ? t("common.submitting") : t("contact.appointment.request")}
                        </Button>
                      </form>
                    </Form>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </section>
    </Layout>
  );
}
