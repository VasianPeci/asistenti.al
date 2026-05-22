import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Conversation } from "../store/historyStore";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  searchQuery?: string;
  onSelect: (id: string) => void;
  onNewConversation?: () => void;
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
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
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

function MessageIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 4.2h8a1.4 1.4 0 0 1 1.4 1.4v4.2a1.4 1.4 0 0 1-1.4 1.4H7.1L4 13.1v-1.9A1.4 1.4 0 0 1 2.6 9.8V5.6A1.4 1.4 0 0 1 4 4.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function CarIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4 7l1.1-2.5h5.8L12 7" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M3.3 7h9.4l.8 1.4v2.5H2.5V8.4L3.3 7Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M4.4 11v1M11.6 11v1" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <circle cx="5" cy="9.2" r=".6" fill="currentColor" />
      <circle cx="11" cy="9.2" r=".6" fill="currentColor" />
    </svg>
  );
}

function DocumentIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.5 2.5h5L12 5v8.5H4.5v-11Z" stroke="currentColor" strokeWidth="1.35" strokeLinejoin="round" />
      <path d="M9.5 2.7v2.8H12M6 8h4M6 10.2h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BuildingIcon(): JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 13h9M4.5 13V6.2L8 3.2l3.5 3V13" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.2 8h.01M8 8h.01M9.8 8h.01M6.2 10.4h.01M8 10.4h.01M9.8 10.4h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function ConversationIcon({ title, active }: { title: string; active: boolean }): JSX.Element {
  const normalized = title.toLocaleLowerCase();
  let icon: JSX.Element;
  if (/(car|vehicle|automjet|makin|regjistr)/i.test(normalized)) icon = <CarIcon />;
  else if (/(tax|nipt|certificate|certifikat|document|dokument|passport|pasaport)/i.test(normalized)) icon = <DocumentIcon />;
  else if (/(business|biznes|open)/i.test(normalized)) icon = <BuildingIcon />;
  else icon = <MessageIcon />;

  return (
    <span
      className={[
        "grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors",
        active ? "bg-white text-accent" : "bg-white/80 text-fg shadow-[0_4px_14px_rgba(26,26,26,0.04)]",
      ].join(" ")}
    >
      {icon}
    </span>
  );
}

export default function ConversationList({
  conversations,
  activeId,
  searchQuery = "",
  onSelect,
  onNewConversation,
  onRename,
  onDelete,
}: ConversationListProps): JSX.Element {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const now = Date.now();
  const yesterdayLabel = t("history.yesterday");
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
  const filtered = normalizedQuery
    ? conversations.filter((c) => conversationTitle(c).toLocaleLowerCase().includes(normalizedQuery))
    : conversations;

  const groups: Record<Group, Conversation[]> = {
    today: [],
    yesterday: [],
    earlier: [],
  };
  for (const c of filtered) groups[groupOf(c.updatedAt, now)].push(c);

  if (filtered.length === 0) {
    return (
      <div className="px-3 py-6 text-[12px] text-gray-muted">
        {conversations.length === 0 ? t("history.empty") : t("history.noSearchResults")}
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
    <div>
      {(["today", "yesterday", "earlier"] as Group[]).map((g) => {
        const items = groups[g];
        if (items.length === 0) return null;
        return (
          <div key={g}>
            <div className="text-[10px] font-bold text-gray-muted tracking-[0.08em] uppercase px-2 pt-3 pb-2">
              {labelMap[g]}
            </div>
            <ul className="m-0 p-0 list-none flex flex-col gap-1.5">
              {items.map((c) => {
                const isActive = c.id === activeId;
                const isEditing = c.id === editingId;
                const title = conversationTitle(c);
                return (
                  <li key={c.id}>
                    <div
                      className={[
                        "group relative flex items-center gap-2 rounded-xl transition-all duration-150",
                        "border-l-[3px]",
                        isActive
                          ? "bg-[#FFF0F2] border-accent shadow-[0_8px_20px_rgba(200,16,46,0.06)]"
                          : "border-transparent hover:bg-white/70",
                      ].join(" ")}
                    >
                      {isEditing ? (
                        <form
                          className="flex min-w-0 flex-1 items-center gap-1 px-2 py-2"
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
                            className="min-w-0 flex-1 rounded-lg border border-border bg-white px-2 py-1.5 text-[12px] text-fg outline-none focus:border-gray"
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
                            className="min-w-0 flex flex-1 items-center gap-3 px-3 py-2.5 text-left"
                          >
                            <ConversationIcon title={title} active={isActive} />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[12px] font-bold leading-tight text-fg">
                                {title}
                              </div>
                              <div className="mt-1 text-[11px] leading-none text-gray">
                                {formatTimestamp(c.updatedAt, now, yesterdayLabel)}
                              </div>
                            </div>
                          </button>
                          <div className="flex shrink-0 items-center pr-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => startRename(c)}
                              aria-label={t("history.rename")}
                              title={t("history.rename")}
                              className="grid h-7 w-7 place-items-center rounded-lg text-gray hover:bg-white hover:text-fg"
                            >
                              <EditIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() => confirmDelete(c.id)}
                              aria-label={t("history.delete")}
                              title={t("history.delete")}
                              className="grid h-7 w-7 place-items-center rounded-lg text-gray hover:bg-white hover:text-fg"
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
      {onNewConversation && (
        <button
          type="button"
          onClick={onNewConversation}
          className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-border bg-white/45 px-3 py-2.5 text-left text-[12px] font-semibold text-gray hover:border-accent/40 hover:text-fg transition-colors"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-accent">
            <MessageIcon />
          </span>
          {t("history.newConversation")}
        </button>
      )}
    </div>
  );
}
