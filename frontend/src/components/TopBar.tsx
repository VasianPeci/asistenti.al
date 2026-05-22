import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

interface TopBarProps {
  onOpenHistory?: () => void;
  onClearConversation?: () => void;
}

function ClockIcon(): JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 5v3.5L10.5 11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RefreshIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M12.5 7A5.5 5.5 0 1 1 7 1.5c1.8 0 3.4.86 4.43 2.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path
        d="M11 1v3.5H7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const FONT_SCALE_KEY = "asistenti.fontScale";
const FONT_SCALES = [0.94, 1, 1.08, 1.16] as const;

type FontScale = (typeof FONT_SCALES)[number];

function isFontScale(value: number): value is FontScale {
  return FONT_SCALES.some((scale) => scale === value);
}

function readFontScale(): FontScale {
  const stored = window.localStorage.getItem(FONT_SCALE_KEY);
  if (!stored) return 1;
  const parsed = Number(stored);
  return isFontScale(parsed) ? parsed : 1;
}

function FontZoomControl(): JSX.Element {
  const { t } = useTranslation();
  const [scale, setScale] = useState<FontScale>(() => readFontScale());

  useEffect(() => {
    document.documentElement.style.setProperty("--app-font-zoom", String(scale));
    window.localStorage.setItem(FONT_SCALE_KEY, String(scale));
  }, [scale]);

  const currentIndex = FONT_SCALES.indexOf(scale);
  const canDecrease = currentIndex > 0;
  const canIncrease = currentIndex < FONT_SCALES.length - 1;

  return (
    <div
      className="flex items-center gap-1 rounded-full bg-soft p-0.5"
      aria-label={t("fontZoom.label")}
    >
      <button
        type="button"
        onClick={() => {
          if (canDecrease) setScale(FONT_SCALES[currentIndex - 1]!);
        }}
        disabled={!canDecrease}
        aria-label={t("fontZoom.decrease")}
        title={t("fontZoom.decrease")}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold text-gray hover:text-fg hover:bg-bg disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
      >
        A-
      </button>
      <button
        type="button"
        onClick={() => setScale(1)}
        aria-label={t("fontZoom.reset")}
        title={t("fontZoom.reset")}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold text-gray hover:text-fg hover:bg-bg transition-colors"
      >
        {Math.round(scale * 100)}
      </button>
      <button
        type="button"
        onClick={() => {
          if (canIncrease) setScale(FONT_SCALES[currentIndex + 1]!);
        }}
        disabled={!canIncrease}
        aria-label={t("fontZoom.increase")}
        title={t("fontZoom.increase")}
        className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold text-gray hover:text-fg hover:bg-bg disabled:opacity-35 disabled:hover:bg-transparent transition-colors"
      >
        A+
      </button>
    </div>
  );
}

export default function TopBar({
  onOpenHistory,
  onClearConversation,
}: TopBarProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 h-[60px] shrink-0 flex items-center justify-between px-4 md:px-7 border-b border-border bg-bg">
      <div className="flex items-center">
        <span className="text-base font-semibold tracking-tight text-fg">
          {t("app.title")}
        </span>
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        {onOpenHistory && (
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label={t("history.title")}
            className="md:hidden flex items-center text-gray hover:text-fg transition-colors p-1"
          >
            <ClockIcon />
          </button>
        )}

        {onClearConversation && (
          <button
            type="button"
            onClick={onClearConversation}
            aria-label={t("history.newConversation")}
            title={t("history.newConversation")}
            className="md:hidden flex items-center text-gray hover:text-fg transition-colors p-1"
          >
            <RefreshIcon />
          </button>
        )}

        <FontZoomControl />
        <LanguageSwitcher />
      </div>
    </header>
  );
}
