import { useTranslation } from "react-i18next";

export default function MessageSkeleton(): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-up" style={{ maxWidth: 720 }} aria-hidden="true">
      <div className="text-[11px] font-medium text-gray-muted tracking-wider uppercase mb-1.5">
        {t("chat.assistantLabel")}
      </div>
      <div className="bg-white border border-border rounded-2xl p-5 md:p-6">
        <div className="skeleton-shimmer h-3 w-[88%] mb-2.5" />
        <div className="skeleton-shimmer h-3 w-[72%] mb-2.5" />
        <div className="skeleton-shimmer h-3 w-[60%] mb-5" />
        <div className="skeleton-shimmer h-2 w-[40%] mb-4" />
        <div className="space-y-2.5">
          <div className="skeleton-shimmer h-3 w-[90%]" />
          <div className="skeleton-shimmer h-3 w-[80%]" />
          <div className="skeleton-shimmer h-3 w-[85%]" />
        </div>
      </div>
    </div>
  );
}
