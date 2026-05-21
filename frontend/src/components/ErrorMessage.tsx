import { useTranslation } from "react-i18next";

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({
  message,
  onRetry,
}: ErrorMessageProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div role="alert" className="animate-fade-up max-w-[720px]">
      <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-1.5">
        {t("chat.assistantLabel")}
      </div>
      <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-xl px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          <span aria-hidden="true" className="text-[15px] leading-[1.4]">⚠️</span>
          <div className="flex-1">
            <p className="text-[13px] text-[#7F1D1D] leading-[1.55] m-0">
              {message}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2 text-[12px] text-accent underline-offset-2 hover:underline transition-colors"
              >
                {t("chat.retry")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
