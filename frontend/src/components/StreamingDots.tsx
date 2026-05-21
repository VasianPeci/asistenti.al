import { useTranslation } from "react-i18next";

export default function StreamingDots(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-up" aria-live="polite" aria-label={t("chat.thinking")}>
      <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-1.5">
        {t("chat.assistantLabel")}
      </div>
      <div className="flex gap-1.5 pt-0.5 pb-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-muted"
            style={{ animation: `dotPulse 1.3s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  );
}
