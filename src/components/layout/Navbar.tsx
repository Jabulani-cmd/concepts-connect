import { useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import schoolLogo from "@/assets/concepts-logo.png";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import LanguageSelect from "@/components/LanguageSelect";

interface NavItem {
  label: string;
  path: string;
  children?: { label: string; path: string }[];
}

function useNavLinks(): NavItem[] {
  const { t } = useTranslation();
  return [
    { label: t("nav.home"), path: "/" },
    {
      label: t("nav.about"),
      path: "/about",
      children: [
        { label: t("nav.news"), path: "/news" },
        { label: t("nav.projects"), path: "/school-projects" },
        { label: t("nav.facilities"), path: "/facilities" },
        { label: t("nav.boarding"), path: "/boarding" },
      ],
    },
    {
      label: t("nav.academics"),
      path: "/academics",
      children: [{ label: t("nav.downloads"), path: "/downloads" }],
    },
    {
      label: t("nav.admissions"),
      path: "/admissions",
      children: [{ label: t("nav.fees"), path: "/fees" }],
    },
    {
      label: t("nav.activities"),
      path: "/sports-culture",
      children: [
        { label: t("nav.schoolLife"), path: "/school-life" },
        { label: t("nav.awards"), path: "/awards" },
      ],
    },
    {
      label: t("nav.staff"),
      path: "/staff",
      children: [{ label: t("nav.vacancies"), path: "/vacancies" }],
    },
    { label: t("nav.contact"), path: "/contact" },
  ];
}

function DesktopDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const timeout = useRef<ReturnType<typeof setTimeout>>();
  const children = item.children ?? [];

  const isActive =
    location.pathname === item.path ||
    item.children?.some((c) => location.pathname === c.path);

  return (
    <div
      className="relative"
      onMouseEnter={() => {
        clearTimeout(timeout.current);
        setOpen(true);
      }}
      onMouseLeave={() => {
        timeout.current = setTimeout(() => setOpen(false), 150);
      }}
    >
      <Link
        to={item.path}
        className={`flex items-center gap-1 whitespace-nowrap px-2 py-2 text-xs font-medium leading-none transition-colors hover:text-primary 2xl:px-3 2xl:text-sm ${
          isActive ? "text-primary" : "text-foreground/80"
        }`}
      >
        {item.label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Link>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-md border border-border bg-popover p-1 shadow-lg"
          >
            {children.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                onClick={() => setOpen(false)}
                className={`block whitespace-nowrap rounded-sm px-3 py-2 text-sm transition-colors hover:bg-muted hover:text-primary ${
                  location.pathname === child.path ? "font-semibold text-primary" : "text-foreground/80"
                }`}
              >
                {child.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileAccordion({ item, onClose }: { item: NavItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const children = item.children ?? [];

  return (
    <div className="border-b border-border/60">
      <div className="flex items-center">
        <Link
          to={item.path}
          onClick={onClose}
          className={`flex-1 px-3 py-3 text-sm font-medium ${
            location.pathname === item.path ? "text-primary" : "text-foreground"
          }`}
        >
          {item.label}
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="p-3 text-foreground/60 hover:text-primary"
          aria-label={`Expand ${item.label}`}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-muted/40 pl-4"
          >
            {children.map((child) => (
              <Link
                key={child.path}
                to={child.path}
                onClick={onClose}
                className={`block px-3 py-2.5 text-sm ${
                  location.pathname === child.path ? "font-semibold text-primary" : "text-foreground/70"
                }`}
              >
                {child.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { t } = useTranslation();
  const navLinks = useNavLinks();


  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container flex items-center justify-between gap-4 py-3">
        {/* Logo left */}
        <Link to="/" className="flex min-w-0 flex-shrink-0 items-center gap-4 rounded-lg outline-none transition-opacity focus-visible:opacity-70 2xl:gap-5">
          <img
            src={schoolLogo}
            alt="MavingTech High School"
            className="h-auto w-14 flex-shrink-0 object-contain sm:w-16 xl:w-20 2xl:w-24"
          />
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="font-heading text-2xl font-extrabold tracking-tight text-foreground md:text-4xl 2xl:text-5xl">
              MavingTech
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-primary md:text-base 2xl:text-lg">
              High School
            </span>
          </div>
        </Link>

        {/* Desktop nav center */}
        <div className="hidden min-w-0 flex-1 items-center justify-center gap-0 xl:flex 2xl:gap-1">
          {navLinks.map((item) =>
            item.children ? (
              <DesktopDropdown key={item.path} item={item} />
            ) : (
              <Link
                key={item.path}
                to={item.path}
                className={`whitespace-nowrap px-2 py-2 text-xs font-medium leading-none transition-colors hover:text-primary 2xl:px-3 2xl:text-sm ${
                  location.pathname === item.path ? "text-primary" : "text-foreground/80"
                }`}
              >
                {item.label}
              </Link>
            )
          )}
        </div>

        {/* Right side: portal + language */}
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSelect />
          <Link to="/login" className="hidden sm:block">
            <Button size="sm" className="whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90">
              {t("nav.portalLogin")}
            </Button>
          </Link>

          <button
            className="flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-muted xl:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={t("nav.menu")}
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-border bg-background xl:hidden"
          >
            <div className="container flex flex-col py-2">
              {navLinks.map((item) =>
                item.children ? (
                  <MobileAccordion key={item.path} item={item} onClose={() => setMobileOpen(false)} />
                ) : (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`border-b border-border/60 px-3 py-3 text-sm font-medium ${
                      location.pathname === item.path ? "text-primary" : "text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              )}
              <Link to="/login" onClick={() => setMobileOpen(false)} className="mt-3">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {t("nav.portalLogin")}
                </Button>
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
