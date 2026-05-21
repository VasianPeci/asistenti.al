import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface MessageBubbleProps {
  variant: "user" | "assistant";
  children: ReactNode;
}

export default function MessageBubble({
  variant,
  children,
}: MessageBubbleProps): JSX.Element {
  const { t } = useTranslation();

  if (variant === "user") {
    return (
      <div className="flex justify-end mb-2 animate-fade-up">
        <div
          className="bg-white border border-border rounded-[18px] rounded-br-[4px] px-4 py-3 text-[15px] leading-relaxed text-fg"
          style={{ maxWidth: "min(75%, 720px)" }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up" style={{ maxWidth: 720 }}>
      <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-1.5">
        {t("chat.assistantLabel")}
      </div>
      <div className="text-[15px] leading-[1.7] text-fg">{children}</div>
    </div>
  );
}
