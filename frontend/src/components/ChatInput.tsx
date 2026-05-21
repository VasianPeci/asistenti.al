import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

interface ChatInputProps {
  onSubmit: (value: string) => void;
  disabled?: boolean;
  size?: "lg" | "sm";
  initialValue?: string;
  autoFocus?: boolean;
}

const MAX_HEIGHT_LG = 132;
const MAX_HEIGHT_SM = 98;

export default function ChatInput({
  onSubmit,
  disabled = false,
  size = "sm",
  initialValue = "",
  autoFocus = false,
}: ChatInputProps): JSX.Element {
  const { t } = useTranslation();
  const [value, setValue] = useState(initialValue);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const isLg = size === "lg";
  const maxHeight = isLg ? MAX_HEIGHT_LG : MAX_HEIGHT_SM;
  const hasText = value.trim().length > 0;
  const canSend = hasText && !disabled;

  useEffect(() => {
    if (initialValue) setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  const submit = (): void => {
    if (!canSend) return;
    onSubmit(value.trim());
    setValue("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div
      className="relative w-full mx-auto transition-opacity"
      style={{ maxWidth: 600, opacity: disabled ? 0.55 : 1 }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={t("input.placeholder")}
        rows={1}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={t("input.placeholder")}
        className={[
          "w-full rounded-3xl bg-white text-fg resize-none outline-none overflow-hidden",
          "transition-[border-color,box-shadow] duration-150",
          "border-[1.5px]",
          focused ? "border-fg shadow-[0_0_0_3px_rgba(200,16,46,0.10)]" : "border-border",
          disabled ? "cursor-not-allowed" : "cursor-text",
          isLg ? "text-[15px] leading-[1.55] py-[15px] pl-[22px] pr-14" : "text-[14px] leading-[1.55] py-3 pl-[18px] pr-[50px]",
        ].join(" ")}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label={t("input.send")}
        className={[
          "absolute top-1/2 -translate-y-1/2 flex items-center justify-center rounded-full transition-all duration-150",
          isLg ? "right-[11px] w-[34px] h-[34px]" : "right-[9px] w-[30px] h-[30px]",
          canSend
            ? "bg-fg hover:scale-105 cursor-pointer animate-[softPulse_2s_ease-in-out_infinite]"
            : "bg-[#E0E0DC] cursor-default",
        ].join(" ")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path
            d="M6 10.5V1.5M1.5 6l4.5-4.5L10.5 6"
            stroke={canSend ? "white" : "#AAAAAA"}
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}
