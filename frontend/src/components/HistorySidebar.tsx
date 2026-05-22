import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistoryStore } from "../store/historyStore";
import ConversationList from "./ConversationList";

interface HistorySidebarProps {
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
}

function SearchIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10.4 10.4L13 13"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShieldIcon(): JSX.Element {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2.8l7.2 3v5.4c0 4.6-2.9 8.2-7.2 10-4.3-1.8-7.2-5.4-7.2-10V5.8l7.2-3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8.7 11.8l2.1 2.1 4.6-4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon(): JSX.Element {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="6.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.1 9.2l1.8 1.8 4-4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HistorySidebar({
  activeId,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
}: HistorySidebarProps): JSX.Element {
  const { t } = useTranslation();
  const conversations = useHistoryStore((s) => s.conversations);
  const [query, setQuery] = useState("");

  return (
    <aside
      className="hidden md:flex w-[292px] shrink-0 flex-col border-r border-border bg-[#FAFAF7]"
      style={{ height: "100dvh" }}
    >
      <div className="px-5 pt-6 pb-4 shrink-0">
        <div className="flex items-center">
          <div className="text-[18px] font-bold tracking-[-0.02em] text-fg">
            {t("history.title")}
          </div>
        </div>

        <label className="mt-6 flex h-[38px] items-center gap-2 rounded-xl border border-border bg-white px-3 shadow-[0_1px_0_rgba(26,26,26,0.02)]">
          <span className="text-gray-muted">
            <SearchIcon />
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("history.searchPlaceholder")}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-fg outline-none placeholder:text-gray-muted"
          />
        </label>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          searchQuery={query}
          onSelect={onSelectConversation}
          onNewConversation={onNewConversation}
          onRename={onRenameConversation}
          onDelete={onDeleteConversation}
        />
      </div>

      <div className="mx-4 mb-4 shrink-0 rounded-xl border border-border bg-white/80 p-3.5 shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#FFF1F3] text-accent">
            <ShieldIcon />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-bold leading-tight text-fg">
              {t("history.trustTitle")}
            </div>
            <div className="mt-1 text-[10px] leading-[1.35] text-gray">
              {t("history.trustText")}
            </div>
          </div>
          <div className="text-accent">
            <CheckCircleIcon />
          </div>
        </div>
      </div>
    </aside>
  );
}
