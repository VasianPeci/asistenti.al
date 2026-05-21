import { Component, type ReactNode } from "react";
import i18n from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

const FALLBACK = {
  al: {
    title: "Diçka shkoi keq",
    body: "Asistenti.al ndeshi në një gabim të papritur. Ju lutemi rifreskoni faqen.",
    cta: "Rifresko",
  },
  en: {
    title: "Something went wrong",
    body: "Asistenti.al ran into an unexpected error. Please refresh the page.",
    cta: "Refresh",
  },
} as const;

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message };
  }

  componentDidCatch(err: Error, info: { componentStack?: string | null }): void {
    console.error("[asistenti] ErrorBoundary caught", err, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    const locale = i18n.language === "en" ? "en" : "al";
    const copy = FALLBACK[locale];
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-6">
        <div className="max-w-md w-full bg-white border border-border rounded-2xl p-8 text-center shadow-card">
          <div className="w-3 h-3 rounded-full bg-accent mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-fg mb-2">{copy.title}</h1>
          <p className="text-sm text-gray mb-6 leading-relaxed">{copy.body}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-full bg-fg text-bg px-5 py-2 text-sm font-medium hover:opacity-90 transition"
          >
            {copy.cta}
          </button>
        </div>
      </div>
    );
  }
}
