import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentResponse } from "../api/types";

interface StepCardProps {
  response: AgentResponse;
}

function CheckIcon(): JSX.Element {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      aria-hidden="true"
      style={{ animation: "fadeUp 0.22s ease-out" }}
    >
      <path
        d="M1.5 5L3.5 7.5L8.5 2.5"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export default function StepCard({ response }: StepCardProps): JSX.Element {
  const { t } = useTranslation();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);

  const total = response.steps.length;
  const done = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );
  const pct = total === 0 ? 0 : done / total;

  const toggle = (i: number): void =>
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const buildCopyText = (): string => {
    const lines: string[] = [response.answer, ""];
    if (response.steps.length > 0) {
      lines.push(t("chat.steps") + ":");
      response.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      lines.push("");
    }
    if (response.documents.length > 0) {
      lines.push(t("chat.documentsRequired") + ":");
      response.documents.forEach((d) => lines.push(`- ${d}`));
      lines.push("");
    }
    if (response.note) lines.push(response.note);
    if (response.source) lines.push(`\n${t("chat.source")}: ${response.source}`);
    return lines.join("\n");
  };

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildCopyText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // best-effort
    }
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth: 720 }}>
      <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-1.5">
        {t("chat.assistantLabel")}
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 md:p-6 relative group">
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? t("chat.copied") : t("chat.copy")}
          title={copied ? t("chat.copied") : t("chat.copy")}
          className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center text-gray-muted hover:text-fg hover:bg-soft transition-all md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M2.5 7.5L5.5 10.5L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="3.5" y="3.5" width="7" height="8" rx="1.2" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M5.5 3.5V2.5A1 1 0 0 1 6.5 1.5h4A1 1 0 0 1 11.5 2.5v6A1 1 0 0 1 10.5 9.5H10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          )}
        </button>
        <p className="text-[14px] leading-[1.7] text-fg mb-4">{response.answer}</p>

        {total > 0 && (
          <>
            <div className="mb-3.5">
              <div className="text-[11px] text-gray-muted mb-1.5">
                {t("chat.progress", { done, total })}
              </div>
              <div className="h-[3px] bg-soft rounded-sm overflow-hidden">
                <div
                  className="h-full bg-fg rounded-sm transition-[width] duration-300 ease-out"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-3">
              {t("chat.steps")}
            </div>

            <ul className="m-0 p-0 list-none">
              {response.steps.map((step, i) => {
                const isChecked = !!checked[i];
                const isLast = i === response.steps.length - 1;
                return (
                  <li
                    key={i}
                    onClick={() => toggle(i)}
                    className={[
                      "flex items-start gap-3 py-2.5 cursor-pointer select-none",
                      isLast ? "" : "border-b border-soft",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isChecked}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggle(i);
                      }}
                      className={[
                        "mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-colors",
                        isChecked
                          ? "bg-fg border-0"
                          : "bg-transparent border-[1.5px] border-[#D0D0CA]",
                      ].join(" ")}
                    >
                      {isChecked && <CheckIcon />}
                    </button>
                    <div className="flex-1 flex gap-2.5">
                      <span className="text-[13px] text-gray-muted shrink-0 min-w-[18px] pt-px">
                        {i + 1}.
                      </span>
                      <span
                        className={[
                          "text-[14px] leading-[1.6] transition-colors",
                          isChecked ? "text-gray-muted line-through" : "text-fg",
                        ].join(" ")}
                      >
                        {step}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {response.documents.length > 0 && (
          <>
            <div className="border-t border-soft my-5" />
            <div className="text-[13px] font-semibold text-fg mb-2.5">
              📋 {t("chat.documentsRequired")}
            </div>
            <ul className="flex flex-wrap gap-2 list-none m-0 p-0">
              {response.documents.map((doc, i) => (
                <li
                  key={i}
                  className="text-[13px] text-fg bg-soft rounded-md px-2.5 py-1"
                >
                  {doc}
                </li>
              ))}
            </ul>
          </>
        )}

        {response.note && (
          <div className="mt-4 bg-[#FDFBF0] border border-[#EDE8A0] rounded-lg px-3.5 py-2.5 text-[13px] text-gray italic leading-[1.5]">
            {response.note}
          </div>
        )}

        {response.source && (
          <div className="mt-3.5 text-[11px] text-gray-muted">
            {t("chat.source")}: {response.source}
          </div>
        )}
      </div>
    </div>
  );
}
