import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import sn from "./locales/sn.json";
import nd from "./locales/nd.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "sn", label: "chiShona", short: "SN" },
  { code: "nd", label: "isiNdebele", short: "ND" },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        sn: { translation: sn },
        nd: { translation: nd },
      },
      fallbackLng: "en",
      supportedLngs: ["en", "sn", "nd"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        caches: ["localStorage"],
        lookupLocalStorage: "mavingtech.lang",
      },
    });
}

export default i18n;
