import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Mail, Phone, MapPin, Twitter, Facebook, Instagram, MessageCircle } from "lucide-react";
import schoolLogo from "@/assets/mavingtech-logo.png";
import ministryLogo from "@/assets/ministry-of-education-logo.png";
import zimsecLogo from "@/assets/zimsec-logo.png";
import cambridgeLogo from "@/assets/cambridge-logo.png";
import { SCHOOL_ADDRESS, SCHOOL_EMAIL, SCHOOL_PHONE, SCHOOL_PHONE_LINK } from "@/lib/school";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="bg-[hsl(var(--footer-bg))] text-[hsl(var(--footer-fg))]">
      <div className="bg-background py-14 border-t border-border">
        <div className="container">
          <p className="mb-10 text-center text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t("footer.affiliations")}
          </p>
          <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 sm:grid-cols-3">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-40 items-center justify-center">
                <img src={ministryLogo} alt="Coat of arms of Zimbabwe" className="max-h-[125px] w-auto object-contain" />
              </div>
              <span className="max-w-[220px] text-center text-xs font-medium leading-tight text-muted-foreground">
                {t("footer.moe")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-40 items-center justify-center">
                <img src={zimsecLogo} alt="ZIMSEC logo" className="max-h-[125px] w-auto object-contain" />
              </div>
              <span className="max-w-[220px] text-center text-xs font-medium leading-tight text-muted-foreground">
                Zimbabwe School Examinations Council
              </span>
            </div>
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-40 items-center justify-center">
                <img src={cambridgeLogo} alt="University of Cambridge logo" className="max-h-[125px] w-auto object-contain" />
              </div>
              <span className="max-w-[220px] text-center text-xs font-medium leading-tight text-muted-foreground">
                Cambridge International Education
              </span>
            </div>
          </div>
        </div>
      </div>


      <div className="container py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <img src={schoolLogo} alt="MavingTech" className="h-[6rem] w-[6rem] object-contain" />
              <span className="font-heading text-xl font-bold">{t("brand.schoolName")}</span>
            </div>
            <p className="text-sm leading-relaxed text-white/70">{t("footer.description")}</p>
            <div className="mt-5 flex items-center gap-3">
              <a href="#" aria-label="Twitter" className="rounded-full border border-white/20 p-2 transition-colors hover:border-primary hover:text-primary"><Twitter className="h-4 w-4" /></a>
              <a href="#" aria-label="Facebook" className="rounded-full border border-white/20 p-2 transition-colors hover:border-primary hover:text-primary"><Facebook className="h-4 w-4" /></a>
              <a href="#" aria-label="Instagram" className="rounded-full border border-white/20 p-2 transition-colors hover:border-primary hover:text-primary"><Instagram className="h-4 w-4" /></a>
              <a href="https://wa.me/263242550123" aria-label="WhatsApp" className="rounded-full border border-white/20 p-2 transition-colors hover:border-primary hover:text-primary"><MessageCircle className="h-4 w-4" /></a>
            </div>
          </div>

          <div>
            <h4 className="mb-4 font-heading text-base font-semibold">{t("footer.quickLinks")}</h4>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li><Link to="/about" className="transition-colors hover:text-primary">{t("footer.aboutUs")}</Link></li>
              <li><Link to="/academics" className="transition-colors hover:text-primary">{t("nav.academics")}</Link></li>
              <li><Link to="/admissions" className="transition-colors hover:text-primary">{t("nav.admissions")}</Link></li>
              <li><Link to="/school-life" className="transition-colors hover:text-primary">{t("nav.schoolLife")}</Link></li>
              <li><Link to="/news" className="transition-colors hover:text-primary">{t("nav.news")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-heading text-base font-semibold">{t("footer.programs")}</h4>
            <ul className="space-y-2.5 text-sm text-white/70">
              <li><Link to="/sports-culture" className="transition-colors hover:text-primary">{t("nav.sportsCulture")}</Link></li>
              <li><Link to="/awards" className="transition-colors hover:text-primary">{t("nav.awards")}</Link></li>
              <li><Link to="/facilities" className="transition-colors hover:text-primary">{t("nav.facilities")}</Link></li>
              <li><Link to="/boarding" className="transition-colors hover:text-primary">{t("nav.boarding")}</Link></li>
              <li><Link to="/fees" className="transition-colors hover:text-primary">{t("nav.fees")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-heading text-base font-semibold">{t("footer.contact")}</h4>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-3">
                <MapPin className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                <span>{SCHOOL_ADDRESS}</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <a href={SCHOOL_PHONE_LINK} className="transition-colors hover:text-primary">{SCHOOL_PHONE}</a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <a href={`mailto:${SCHOOL_EMAIL}`} className="transition-colors hover:text-primary">{SCHOOL_EMAIL}</a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/50">
          <p>© {new Date().getFullYear()} {t("brand.schoolName")}. {t("footer.rights")}</p>
        </div>
      </div>
    </footer>
  );
}
