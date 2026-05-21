import { useMemo } from "react";
import { useTranslation } from "react-i18next";

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  count?: number;
}

const ALL_KEYS = [
  "suggestions.business",
  "suggestions.passport",
  "suggestions.license",
  "suggestions.vehicle",
  "suggestions.residence",
  "suggestions.marriage",
  "suggestions.birthCertificate",
  "suggestions.tax",
] as const;

function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

export default function SuggestedQuestions({
  onSelect,
  count = 3,
}: SuggestedQuestionsProps): JSX.Element {
  const { t, i18n } = useTranslation();
  const picks = useMemo(
    () => shuffle(ALL_KEYS).slice(0, count),
    // re-randomize when language changes so labels and order both refresh
    [count, i18n.language]
  );

  return (
    <div className="flex flex-col md:flex-row flex-wrap justify-center gap-2 w-full max-w-[580px] mx-auto px-2 md:px-0">
      {picks.map((key) => {
        const label = t(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(label)}
            className="block text-center md:text-left whitespace-normal md:whitespace-nowrap px-4 py-2 text-[13px] text-gray bg-transparent hover:bg-white border border-border hover:border-[#C4C3BC] hover:text-fg rounded-full transition-all duration-150"
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
