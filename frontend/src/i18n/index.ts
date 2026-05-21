import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import al from "./locales/al.json";
import en from "./locales/en.json";

export const SUPPORTED_LOCALES = ["al", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

const STORAGE_KEY = "asistenti_locale";

function loadStoredLocale(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "al" || v === "en") return v;
  } catch {
    // private mode — ignore
  }
  return "al";
}

void i18n.use(initReactI18next).init({
  resources: {
    al: { translation: al },
    en: { translation: en },
  },
  lng: loadStoredLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export function setLocale(locale: Locale): void {
  void i18n.changeLanguage(locale);
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore
  }
}

export default i18n;
