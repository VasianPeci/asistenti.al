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

function TopBarLogo(): JSX.Element {
  return (
    <div className="topbar-logo" aria-hidden="true">
      <span className="topbar-logo__spark topbar-logo__spark--left" />
      <span className="topbar-logo__spark topbar-logo__spark--right" />
      <div className="topbar-logo__bot">
        <span className="topbar-logo__antenna" />
        <span className="topbar-logo__head">
          <span className="topbar-logo__visor">
            <span />
            <span />
          </span>
          <span className="topbar-logo__mouth" />
        </span>
        <span className="topbar-logo__body">
          <span className="topbar-logo__eagle">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path
                d="M16 5.6c-1.4 2-3 3.1-5.2 3.4 1.3.7 2.5 1.3 3.2 2.2-2.5-.9-5.6-1.1-8.6-.1 2.2 1.1 4.1 2.2 5.1 3.7-2.5-.4-4.6.1-6.5 1.7 2.3.1 4.3.7 5.5 1.9-1.4.2-2.5.8-3.3 1.8 2.5-.2 4.6.5 6.1 2.1-.4 1.1-.9 2.1-1.6 3.2 1.8-.4 3.3-1.2 4.4-2.5.3 1.2.6 2.3.9 3.4.3-1.1.6-2.2.9-3.4 1.1 1.3 2.6 2.1 4.4 2.5-.7-1.1-1.2-2.1-1.6-3.2 1.5-1.6 3.6-2.3 6.1-2.1-.8-1-1.9-1.6-3.3-1.8 1.2-1.2 3.2-1.8 5.5-1.9-1.9-1.6-4-2.1-6.5-1.7 1-1.5 2.9-2.6 5.1-3.7-3-1-6.1-.8-8.6.1.7-.9 1.9-1.5 3.2-2.2-2.2-.3-3.8-1.4-5.2-3.4Z"
                fill="currentColor"
              />
            </svg>
          </span>
        </span>
        <span className="topbar-logo__arm topbar-logo__arm--left" />
        <span className="topbar-logo__arm topbar-logo__arm--right" />
        <span className="topbar-logo__shadow" />
      </div>
    </div>
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
      <div className="flex items-center gap-2">
        <TopBarLogo />
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
