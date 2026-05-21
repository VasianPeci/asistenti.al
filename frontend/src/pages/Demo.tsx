/**
 * Backup demo route — renders a hardcoded passport renewal StepCard.
 * Use as fallback if live backend is unavailable during demo day.
 * URL: /demo
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import TopBar from "../components/TopBar";
import LanguageSwitcher from "../components/LanguageSwitcher";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import StepCard from "../components/StepCard";
import StreamingDots from "../components/StreamingDots";
import SuggestedQuestions from "../components/SuggestedQuestions";
import HistorySidebar from "../components/HistorySidebar";
import MobileHistoryDrawer from "../components/MobileHistoryDrawer";
import { useHistoryStore } from "../store/historyStore";
import type { AgentResponse } from "../api/types";

const SAMPLE_RESPONSE: AgentResponse = {
  answer:
    "Për të rinovuar pasaportën tuaj, duhet të aplikoni pranë DPGJC ose Komisariatit të Policisë. Ja hapat e nevojshme:",
  steps: [
    "Paraqituni pranë sportelit DPGJC ose Komisariatit të Policisë",
    "Plotësoni formularin e aplikimit (disponueshëm në e-albania.al)",
    "Paguani tarifën e shërbimit prej 5,000 Lekësh pranë bankës ose postës",
    "Dorëzoni formularin dhe dokumentet e nevojshme pranë sportelit",
    "Prisni konfirmimin me SMS ose email (5–10 ditë pune)",
    "Tërhiqni pasaportën tuaj të re pranë sportelit",
  ],
  documents: [
    "Kartë identiteti (ID)",
    "2 foto pasaporti 35×45mm",
    "Vërtetim pagese",
    "Pasaporta e vjetër",
  ],
  source: "dpgjc.gov.al",
  note: "Pasaporta rinovohet çdo 10 vjet (të rriturit 18+), çdo 5 vjet (fëmijët).",
};

function Section({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <section className="mb-10">
      <h2 className="text-[10.5px] font-semibold text-[#94928B] tracking-[0.1em] uppercase mb-3">
        ── {title} ──
      </h2>
      <div className="bg-bg border border-border rounded-2xl p-6">{children}</div>
    </section>
  );
}

export default function Demo(): JSX.Element {
  const { t } = useTranslation();
  const { createConversation, saveMessage, conversations } = useHistoryStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastSubmitted, setLastSubmitted] = useState("");
  const [pickedSuggestion, setPickedSuggestion] = useState("");

  useEffect(() => {
    if (conversations.length === 0) {
      const a = createConversation();
      saveMessage(a, {
        id: "m1",
        role: "user",
        content: "Si të rinovoj pasaportën?",
        createdAt: Date.now(),
      });
      const b = createConversation();
      saveMessage(b, {
        id: "m2",
        role: "user",
        content: "Si të hap një biznes shpk?",
        createdAt: Date.now() - 26 * 60 * 60 * 1000,
      });
      setActiveId(a);
    }
  }, [conversations.length, createConversation, saveMessage]);

  return (
    <div className="min-h-screen bg-page">
      <TopBar
        onOpenHistory={() => setDrawerOpen(true)}
        onClearConversation={() => {
          const id = createConversation();
          setActiveId(id);
        }}
      />

      <div className="flex">
        <HistorySidebar
          activeId={activeId}
          onSelectConversation={setActiveId}
          onNewConversation={() => {
            const id = createConversation();
            setActiveId(id);
          }}
        />

        <main className="flex-1 px-4 md:px-8 py-8 max-w-[920px] mx-auto w-full">
          <h1 className="text-2xl font-semibold text-fg mb-1">Component demo</h1>
          <p className="text-sm text-gray mb-8">
            Each component below renders in isolation. {t("app.tagline")}.
          </p>

          <Section title="LanguageSwitcher">
            <LanguageSwitcher />
          </Section>

          <Section title="StreamingDots">
            <StreamingDots />
          </Section>

          <Section title="SuggestedQuestions">
            <SuggestedQuestions onSelect={setPickedSuggestion} />
            {pickedSuggestion && (
              <p className="mt-3 text-xs text-gray">picked: {pickedSuggestion}</p>
            )}
          </Section>

          <Section title="ChatInput (sm)">
            <ChatInput onSubmit={setLastSubmitted} size="sm" />
            {lastSubmitted && (
              <p className="mt-3 text-xs text-gray">submitted: {lastSubmitted}</p>
            )}
          </Section>

          <Section title="ChatInput (lg, disabled)">
            <ChatInput onSubmit={() => undefined} size="lg" disabled />
          </Section>

          <Section title="MessageBubble — user">
            <MessageBubble variant="user">Si të rinovoj pasaportën?</MessageBubble>
          </Section>

          <Section title="MessageBubble — assistant (plain)">
            <MessageBubble variant="assistant">
              Pasaporta rinovohet pranë DPGJC. Ja hapat kryesorë…
            </MessageBubble>
          </Section>

          <Section title="StepCard">
            <StepCard response={SAMPLE_RESPONSE} />
          </Section>

          <Section title="MobileHistoryDrawer (open below 768px)">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="text-[13px] text-fg underline"
            >
              Open drawer
            </button>
          </Section>
        </main>
      </div>

      <MobileHistoryDrawer
        isOpen={drawerOpen}
        activeId={activeId}
        onClose={() => setDrawerOpen(false)}
        onSelectConversation={setActiveId}
        onNewConversation={() => {
          const id = createConversation();
          setActiveId(id);
        }}
      />
    </div>
  );
}
