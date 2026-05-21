import { useTranslation } from "react-i18next";
import { useHistoryStore } from "../store/historyStore";
import ConversationList from "./ConversationList";

interface HistorySidebarProps {
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
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

export default function HistorySidebar({
  activeId,
  onSelectConversation,
  onNewConversation,
}: HistorySidebarProps): JSX.Element {
  const { t } = useTranslation();
  const conversations = useHistoryStore((s) => s.conversations);

  return (
    <aside
      className="hidden md:flex w-[260px] shrink-0 flex-col border-r border-border"
      style={{ background: "#EFEDE8", height: "calc(100dvh - 60px)" }}
    >
      <div className="px-4 pt-5 pb-3 border-b border-border">
        <div className="text-[11px] font-medium text-gray-muted tracking-[0.08em] uppercase">
          {t("history.title")}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={onSelectConversation}
        />
      </div>

      <div className="border-t border-border shrink-0">
        <button
          type="button"
          onClick={onNewConversation}
          className="w-full px-4 py-[14px] flex items-center gap-[7px] text-[13px] text-fg text-left hover:bg-[#E4E2DC] transition-colors duration-150"
        >
          <RefreshIcon />
          {t("history.newConversation")}
        </button>
      </div>
    </aside>
  );
}
