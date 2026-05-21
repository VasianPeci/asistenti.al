import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useHistoryStore } from "../store/historyStore";
import ConversationList from "./ConversationList";

interface MobileHistoryDrawerProps {
  isOpen: boolean;
  activeId: string | null;
  onClose: () => void;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onRenameConversation: (id: string, title: string) => void;
  onDeleteConversation: (id: string) => void;
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

export default function MobileHistoryDrawer({
  isOpen,
  activeId,
  onClose,
  onSelectConversation,
  onNewConversation,
  onRenameConversation,
  onDeleteConversation,
}: MobileHistoryDrawerProps): JSX.Element | null {
  const { t } = useTranslation();
  const conversations = useHistoryStore((s) => s.conversations);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/30 animate-fade-up"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col rounded-t-2xl border-t border-border"
        style={{
          background: "#EFEDE8",
          height: "min(78vh, 620px)",
          animation: "slideUp 0.22s ease-out both",
        }}
      >
        <div className="flex justify-center pt-2.5 pb-1 shrink-0">
          <span
            aria-hidden="true"
            className="block rounded-full"
            style={{ width: 40, height: 4, background: "#D0D0CA" }}
          />
        </div>
        <div className="px-4 py-2 border-b border-border shrink-0">
          <div className="text-[11px] font-medium text-gray-muted tracking-[0.08em] uppercase">
            {t("history.title")}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-1">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={(id) => {
              onSelectConversation(id);
              onClose();
            }}
            onRename={onRenameConversation}
            onDelete={onDeleteConversation}
          />
        </div>
        <div className="border-t border-border shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewConversation();
              onClose();
            }}
            className="w-full px-4 py-[14px] flex items-center gap-[7px] text-[13px] text-fg text-left hover:bg-[#E4E2DC] transition-colors duration-150"
          >
            <RefreshIcon />
            {t("history.newConversation")}
          </button>
        </div>
      </div>
    </div>
  );
}
