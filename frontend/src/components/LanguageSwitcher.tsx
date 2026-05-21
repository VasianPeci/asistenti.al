import { useTranslation } from "react-i18next";
import { setLocale, type Locale } from "../i18n";

const ORDER: Locale[] = ["al", "en"];
const LABEL: Record<Locale, string> = { al: "AL", en: "EN" };

export default function LanguageSwitcher(): JSX.Element {
  const { i18n, t } = useTranslation();
  const current: Locale = i18n.language === "en" ? "en" : "al";

  return (
    <div
      role="group"
      aria-label={t("language.toggle")}
      className="inline-flex items-center gap-0.5"
    >
      {ORDER.map((l) => {
        const active = current === l;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLocale(l)}
            aria-pressed={active}
            className={[
              "rounded-full text-[11px] tracking-wider transition-all duration-150",
              active
                ? "bg-fg text-bg font-semibold px-3 py-[5px]"
                : "bg-transparent text-gray-muted font-normal px-2 py-[5px] hover:text-fg",
            ].join(" ")}
          >
            {LABEL[l]}
          </button>
        );
      })}
    </div>
  );
}
