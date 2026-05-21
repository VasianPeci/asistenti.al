import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../store/historyStore";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

type Group = "today" | "yesterday" | "earlier";

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function groupOf(ts: number, now: number): Group {
  const todayStart = startOfDay(now);
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  if (ts >= todayStart) return "today";
  if (ts >= yesterdayStart) return "yesterday";
  return "earlier";
}

function formatTimestamp(ts: number, now: number, yesterdayLabel: string): string {
  const group = groupOf(ts, now);
  if (group === "today") {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (group === "yesterday") return yesterdayLabel;
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function untitledConversationLabel(conversation: Conversation): string {
  return conversation.locale === "en" ? "New conversation" : "Bisedë e re";
}

function conversationTitle(conversation: Conversation): string {
  return conversation.title || untitledConversationLabel(conversation);
}

function EditIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.2 9.9L2 12l2.1-.2 6.7-6.7-1.9-1.9-6.7 6.7Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M8.3 3.8l1.9 1.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function TrashIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 3.5h9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M5.5 2.2h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M4 5l.4 6.2c.04.6.5 1 1.1 1h3c.6 0 1.06-.4 1.1-1L10 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function CheckIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M2.5 7.4l3 3L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function XIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
  onRename,
  onDelete,
}: ConversationListProps): JSX.Element {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const now = Date.now();
  const yesterdayLabel = t("history.yesterday");

  const groups: Record<Group, Conversation[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const c of conversations) groups[groupOf(c.updatedAt, now)].push(c);

  if (conversations.length === 0) {
    return (
      <div className="px-4 py-6 text-[12px] text-gray-muted">
        {t("history.empty")}
      </div>
    );
  }

  const labelMap: Record<Group, string> = {
    today: t("history.today"),
    yesterday: t("history.yesterday"),
    earlier: t("history.earlier"),
  };

  const startRename = (conversation: Conversation): void => {
    setEditingId(conversation.id);
    setDraftTitle(conversationTitle(conversation));
  };

  const finishRename = (): void => {
    if (!editingId) return;
    const trimmed = draftTitle.trim();
    if (trimmed) onRename(editingId, trimmed);
    setEditingId(null);
    setDraftTitle("");
  };

  const cancelRename = (): void => {
    setEditingId(null);
    setDraftTitle("");
  };

  const confirmDelete = (id: string): void => {
    if (!window.confirm(t("history.deleteConfirm"))) return;
    if (editingId === id) cancelRename();
    onDelete(id);
  };

  return (
    <div className="px-1.5">
      {(["today", "yesterday", "earlier"] as Group[]).map((g) => {
        const items = groups[g];
        if (items.length === 0) return null;
        return (
          <div key={g}>
            <div className="text-[10px] font-semibold text-[#AAAAAA] tracking-[0.08em] uppercase px-[14px] pt-[14px] pb-[6px]">
              {labelMap[g]}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-0.5">
              {items.map((c) => {
                const isActive = c.id === activeId;
                const isEditing = c.id === editingId;
                return (
                  <li key={c.id}>
                    <div
                      className={[
                        "group flex items-center gap-1 rounded-lg transition-colors duration-100",
                        "border-l-2 -ml-px",
                        isActive
                          ? "bg-[#E4E2DC] border-accent"
                          : "border-transparent hover:bg-[#E8E6E0]",
                      ].join(" ")}
                    >
                      {isEditing ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-1 px-[10px] py-[7px]"
                          onSubmit={(e) => {
                            e.preventDefault();
                            finishRename();
                          }}
                        >
                          <input
                            value={draftTitle}
                            onChange={(e) => setDraftTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") cancelRename();
                            }}
                            autoFocus
                            className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1 text-[13px] text-fg outline-none focus:border-gray"
                          />
                          <button
                            type="submit"
                            aria-label={t("history.save")}
                            title={t("history.save")}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-gray hover:bg-white hover:text-fg"
                          >
                            <CheckIcon />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            aria-label={t("history.cancel")}
                            title={t("history.cancel")}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-gray hover:bg-white hover:text-fg"
                          >
                            <XIcon />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => onSelect(c.id)}
                            className="min-w-0 flex-1 px-[14px] py-[10px] text-left"
                          >
                            <div className="truncate text-[13px] text-fg">
                              {conversationTitle(c)}
                            </div>
                            <div className="mt-0.5 text-[11px] text-[#AAAAAA]">
                              {formatTimestamp(c.updatedAt, now, yesterdayLabel)}
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center pr-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => startRename(c)}
                              aria-label={t("history.rename")}
                              title={t("history.rename")}
                              className="grid h-8 w-8 place-items-center rounded-md text-gray hover:bg-white/70 hover:text-fg"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(c.id)}
                              aria-label={t("history.delete")}
                              title={t("history.delete")}
                              className="grid h-8 w-8 place-items-center rounded-md text-gray hover:bg-white/70 hover:text-fg"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
