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

export default function TopBar({
  onOpenHistory,
  onClearConversation,
}: TopBarProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-30 h-[60px] shrink-0 flex items-center justify-between px-4 md:px-7 border-b border-border bg-bg">
      <div className="flex items-center gap-2">
        <span className="w-[7px] h-[7px] rounded-full bg-accent shrink-0" aria-hidden="true" />
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

        <LanguageSwitcher />
      </div>
    </header>
  );
}
