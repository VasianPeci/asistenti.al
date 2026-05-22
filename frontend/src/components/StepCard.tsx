import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AgentResponse, StepChannel, StepDetail, StepDifficulty } from "../api/types";

interface StepCardProps {
  response: AgentResponse;
  onServiceSelect?: (query: string) => void;
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

function PdfIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path
        d="M4 1.75h4.2L11 4.55v7.7H4a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path d="M8 1.9v2.9h2.9" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="M5 8.25h4M5 10h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export default function StepCard({ response, onServiceSelect }: StepCardProps): JSX.Element {
  const { i18n, t } = useTranslation();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  const total = response.steps.length;
  const services = response.services ?? [];
  const canExportPdf = response.steps.length > 0 && response.documents.length > 0;
  const responseLocale =
    response.language === "sq" ? "al" : response.language === "en" ? "en" : i18n.language;
  const tr = (key: string, values?: Record<string, unknown>): string =>
    t(key, { ...values, lng: responseLocale });
  const done = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );
  const pct = total === 0 ? 0 : done / total;

  useEffect(() => {
    if (total === 0 || done !== total) {
      setCelebrate(false);
      return;
    }
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 2600);
    return () => window.clearTimeout(timer);
  }, [done, total]);

  const toggle = (i: number): void =>
    setChecked((prev) => ({ ...prev, [i]: !prev[i] }));

  const buildCopyText = (): string => {
    const lines: string[] = [response.answer, ""];
    if (services.length > 0) {
      lines.push(tr("chat.services") + ":");
      services.forEach((service) => lines.push(`- ${service.label}`));
      lines.push("");
    }
    if (response.steps.length > 0) {
      lines.push(tr("chat.steps") + ":");
      response.steps.forEach((s, i) => {
        const details = getStepDetail(i, s);
        lines.push(
          `${i + 1}. ${s} (${formatStepMeta(details.difficulty, details.channel)})`
        );
      });
      lines.push("");
    }
    if (response.documents.length > 0) {
      lines.push(tr("chat.documentsRequired") + ":");
      response.documents.forEach((d) => lines.push(`- ${d}`));
      lines.push("");
    }
    if (response.note) lines.push(response.note);
    if (response.source) lines.push(`\n${tr("chat.source")}: ${response.source}`);
    return lines.join("\n");
  };

  const inferChannel = (step: string): StepChannel => {
    const text = step.toLocaleLowerCase();
    const digital = /(online|portal|e-albania|elektronik|llogari|account|upload|ngarko|submit|d[eë]rgo|form|formular)/i.test(text);
    const manual = /(office|zyr[eë]|paraqit|fizik|personalisht|sportel|appointment|takim|coupon|kupon|print|scan|n[eë]nshkruar)/i.test(text);
    if (digital && manual) return "hybrid";
    if (manual) return "manual";
    return "digital";
  };

  const inferDifficulty = (step: string, channel: StepChannel): StepDifficulty => {
    const text = step.toLocaleLowerCase();
    if (/(court|gjykat|noter|prokur|power of attorney|prokur[eë]|authorization|autorizim|appeal|ankim|verification|verifikim)/i.test(text)) {
      return "hard";
    }
    if (channel === "manual" || /(payment|pages[eë]|fee|tarif|appointment|takim|wait|prit|working days|dit[eë] pune|document|dokument|upload|ngarko)/i.test(text)) {
      return "medium";
    }
    return "easy";
  };

  const getStepDetail = (index: number, step: string): StepDetail => {
    const detail = response.stepDetails?.[index];
    if (detail) return detail;
    const channel = inferChannel(step);
    return {
      channel,
      difficulty: inferDifficulty(step, channel),
      note: null,
    };
  };

  const formatStepMeta = (difficulty: StepDifficulty, channel: StepChannel): string =>
    `${tr(`chat.difficulty.${difficulty}`)} · ${tr(`chat.channel.${channel}`)}`;

  const normalizePdfText = (value: string): string =>
    value
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...")
      .replace(/•/g, "-")
      .replace(/™/g, "TM")
      .replace(/€|£|¥/g, "")
      .replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g, "");

  const escapePdfString = (value: string): string =>
    normalizePdfText(value)
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\r?\n/g, " ");

  const latin1Bytes = (value: string): Uint8Array => {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      bytes[i] = value.charCodeAt(i) & 0xff;
    }
    return bytes;
  };

  const wrapPdfText = (text: string, maxChars: number): string[] => {
    const words = normalizePdfText(text).replace(/\s+/g, " ").trim().split(" ");
    const lines: string[] = [];
    let current = "";

    words.forEach((word) => {
      if (!word) return;
      if (word.length > maxChars) {
        if (current) {
          lines.push(current);
          current = "";
        }
        for (let i = 0; i < word.length; i += maxChars) {
          lines.push(word.slice(i, i + maxChars));
        }
        return;
      }
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    });

    if (current) lines.push(current);
    return lines.length > 0 ? lines : [""];
  };

  const buildPdfBytes = (): Uint8Array => {
    const pageWidth = 595;
    const pageHeight = 842;
    const margin = 54;
    const contentWidth = pageWidth - margin * 2;
    const pages: string[] = [];
    let y = pageHeight - margin;
    let current = "";

    const startPage = (): void => {
      if (current) pages.push(current);
      current = "";
      y = pageHeight - margin;
    };

    const ensureSpace = (height: number): void => {
      if (y - height < margin) startPage();
    };

    const writeLine = (
      text: string,
      options?: { size?: number; bold?: boolean; indent?: number; color?: string }
    ): void => {
      const size = options?.size ?? 12;
      const indent = options?.indent ?? 0;
      const color = options?.color ?? "0.10 0.10 0.10";
      const font = options?.bold ? "F2" : "F1";
      ensureSpace(size + 8);
      current += `${color} rg BT /${font} ${size} Tf ${margin + indent} ${y} Td (${escapePdfString(text)}) Tj ET\n`;
      y -= size + 6;
    };

    const writeWrapped = (
      text: string,
      options?: { size?: number; bold?: boolean; indent?: number; color?: string; gapAfter?: number }
    ): void => {
      const size = options?.size ?? 12;
      const indent = options?.indent ?? 0;
      const maxChars = Math.max(18, Math.floor((contentWidth - indent) / (size * 0.52)));
      wrapPdfText(text, maxChars).forEach((line) => writeLine(line, options));
      y -= options?.gapAfter ?? 4;
    };

    const writeSection = (title: string): void => {
      y -= 8;
      writeWrapped(title.toLocaleUpperCase(), {
        size: 10,
        bold: true,
        color: "0.42 0.42 0.42",
        gapAfter: 2,
      });
    };

    writeWrapped(tr("chat.exportTitle"), { size: 20, bold: true, gapAfter: 10 });
    writeWrapped(response.answer, { size: 12, gapAfter: 6 });

    writeSection(tr("chat.steps"));
    response.steps.forEach((step, i) => {
      const details = getStepDetail(i, step);
      writeWrapped(`${i + 1}. ${step}`, { size: 12, indent: 10, gapAfter: 1 });
      writeWrapped(formatStepMeta(details.difficulty, details.channel), {
        size: 9,
        indent: 24,
        color: "0.42 0.42 0.42",
        gapAfter: 6,
      });
    });

    writeSection(tr("chat.documentsRequired"));
    response.documents.forEach((doc) => {
      writeWrapped(`- ${doc}`, { size: 12, indent: 10, gapAfter: 2 });
    });

    if (response.note) {
      writeSection(tr("chat.note"));
      writeWrapped(response.note, { size: 11, color: "0.42 0.42 0.42", gapAfter: 4 });
    }

    if (response.source) {
      y -= 10;
      writeWrapped(`${tr("chat.source")}: ${response.source}`, {
        size: 10,
        color: "0.42 0.42 0.42",
      });
    }

    if (current) pages.push(current);

    const objects: string[] = [];
    const addObject = (body: string): number => {
      objects.push(body);
      return objects.length;
    };

    const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
    const pagesId = addObject("");
    const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const boldFontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pageIds: number[] = [];

    pages.forEach((pageContent) => {
      const contentId = addObject(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}endstream`);
      const pageId = addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    });

    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    let output = "%PDF-1.4\n";
    const offsets: number[] = [0];
    objects.forEach((body, index) => {
      offsets[index + 1] = output.length;
      output += `${index + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xrefOffset = output.length;
    output += `xref\n0 ${objects.length + 1}\n`;
    output += "0000000000 65535 f \n";
    for (let i = 1; i <= objects.length; i += 1) {
      output += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }
    output += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return latin1Bytes(output);
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

  const handleExportPdf = (): void => {
    const pdf = buildPdfBytes();
    const buffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(buffer).set(pdf);
    const blob = new Blob([buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `asistenti-service-guidance-${date}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-fade-up" style={{ maxWidth: 720 }}>
      <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-1.5">
        {t("chat.assistantLabel")}
      </div>

      <div className="bg-white border border-border rounded-2xl p-5 md:p-6 relative group">
        <div className="absolute top-3 right-3 flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {canExportPdf && (
            <button
              type="button"
              onClick={handleExportPdf}
              aria-label={t("chat.exportPdf")}
              title={t("chat.exportPdf")}
              className="w-7 h-7 rounded-full flex items-center justify-center text-gray-muted hover:text-fg hover:bg-soft transition-all"
            >
              <PdfIcon />
            </button>
          )}
          <button
            type="button"
            onClick={() => void handleCopy()}
            aria-label={copied ? t("chat.copied") : t("chat.copy")}
            title={copied ? t("chat.copied") : t("chat.copy")}
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-muted hover:text-fg hover:bg-soft transition-all"
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
        </div>
        <p className="text-[14px] leading-[1.7] text-fg mb-4">{response.answer}</p>

        {total > 0 && (
          <>
            <div className="mb-3.5">
              <div className="text-[11px] text-gray-muted mb-1.5">
                {tr("chat.progress", { done, total })}
              </div>
              <div className="h-[3px] bg-soft rounded-sm overflow-hidden">
                <div
                  className="h-full bg-fg rounded-sm transition-[width] duration-300 ease-out"
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </div>

            <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-3">
              {tr("chat.steps")}
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
                      <div className="flex-1">
                        <span
                          className={[
                            "text-[14px] leading-[1.6] transition-colors",
                            isChecked ? "text-gray-muted line-through" : "text-fg",
                          ].join(" ")}
                        >
                          {step}
                        </span>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {(() => {
                            const details = getStepDetail(i, step);
                            return (
                              <>
                                <span className="text-[11px] text-gray bg-soft rounded-full px-2 py-0.5">
                                  {tr(`chat.difficulty.${details.difficulty}`)}
                                </span>
                                <span className="text-[11px] text-gray bg-soft rounded-full px-2 py-0.5">
                                  {tr(`chat.channel.${details.channel}`)}
                                </span>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {done === total && (
              <div className="mt-4 rounded-lg border border-[#DAD7C5] bg-[#FCFAEF] px-3.5 py-2.5 text-[13px] text-fg leading-[1.5] relative overflow-hidden">
                {celebrate && (
                  <div className="pointer-events-none absolute inset-0">
                    {Array.from({ length: 14 }).map((_, i) => (
                      <span
                        key={i}
                        className="absolute w-1.5 h-2.5 rounded-sm animate-[confetti_1.6s_ease-out_forwards]"
                        style={{
                          left: `${8 + i * 6}%`,
                          top: "-10%",
                          backgroundColor: ["#1F7A5A", "#D9A441", "#C65B4A", "#4B75B8"][i % 4],
                          animationDelay: `${(i % 5) * 0.08}s`,
                          transform: `rotate(${i * 17}deg)`,
                        }}
                      />
                    ))}
                  </div>
                )}
                {tr("chat.completed")}
              </div>
            )}
          </>
        )}

        {services.length > 0 && (
          <>
            <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-3">
              {tr("chat.services")}
            </div>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <button
                  key={service.query}
                  type="button"
                  onClick={() => onServiceSelect?.(service.query)}
                  className="text-[13px] text-fg bg-soft hover:bg-[#E7E7DF] rounded-md px-3 py-1.5 transition-colors"
                >
                  {service.label}
                </button>
              ))}
            </div>
          </>
        )}

        {response.documents.length > 0 && (
          <>
            <div className="border-t border-soft my-5" />
            <div className="text-[13px] font-semibold text-fg mb-2.5">
              {tr("chat.documentsRequired")}
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
            {tr("chat.source")}: {response.source}
          </div>
        )}
      </div>
    </div>
  );
}
