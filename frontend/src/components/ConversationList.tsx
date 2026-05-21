import { useTranslation } from "react-i18next";
import type { Conversation } from "../store/historyStore";

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
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

export default function ConversationList({
  conversations,
  activeId,
  onSelect,
}: ConversationListProps): JSX.Element {
  const { t } = useTranslation();
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
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(c.id)}
                      className={[
                        "w-full text-left px-[14px] py-[10px] rounded-lg transition-colors duration-100",
                        "border-l-2 -ml-px",
                        isActive
                          ? "bg-[#E4E2DC] border-accent"
                          : "border-transparent hover:bg-[#E8E6E0]",
                      ].join(" ")}
                    >
                      <div className="text-[13px] text-fg truncate">
                        {c.title || t("history.newConversation")}
                      </div>
                      <div className="text-[11px] text-[#AAAAAA] mt-0.5">
                        {formatTimestamp(c.updatedAt, now, yesterdayLabel)}
                      </div>
                    </button>
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
