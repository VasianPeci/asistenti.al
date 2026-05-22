import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import TopBar from "../components/TopBar";
import HistorySidebar from "../components/HistorySidebar";
import MobileHistoryDrawer from "../components/MobileHistoryDrawer";
import ChatInput from "../components/ChatInput";
import MessageBubble from "../components/MessageBubble";
import StepCard from "../components/StepCard";
import StreamingDots from "../components/StreamingDots";
import MessageSkeleton from "../components/MessageSkeleton";
import ErrorMessage from "../components/ErrorMessage";
import SuggestedQuestions from "../components/SuggestedQuestions";
import { useChatStore } from "../store/chatStore";
import { useHistoryStore } from "../store/historyStore";
import {
  deleteSession,
  restoreSession,
  streamChat,
} from "../api/client";
import { extractStreamingAnswer } from "../api/streamingJson";
import type { Message } from "../api/types";

export default function Chat(): JSX.Element {
  const { t } = useTranslation();

  const {
    sessionId,
    messages,
    isStreaming,
    streamingText,
    error,
    startNewConversation,
    setActiveConversation,
    appendUserMessage,
    beginStream,
    appendStreamToken,
    finalizeStream,
    failStream,
  } = useChatStore();

  const {
    conversations,
    createConversation,
    deleteConversation,
    renameConversation,
  } = useHistoryStore();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const displayStreamingText = useMemo(
    () => extractStreamingAnswer(streamingText),
    [streamingText]
  );
  const initialized = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Initial bootstrap: load most recent conversation or create one.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const all = useHistoryStore.getState().listConversations();
    if (all.length > 0) {
      const recent = all[0]!;
      setActiveConversation(recent.id);
      if (recent.messages.length > 0) {
        void restoreSession(recent.id, recent.messages);
      }
    } else {
      startNewConversation();
    }
  }, [setActiveConversation, startNewConversation]);

  // Auto-scroll on new content.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, streamingText, isStreaming]);

  const handleClearConversation = useCallback((): void => {
    if (!sessionId) return;
    const hasMessages = useChatStore.getState().messages.length > 0;
    if (hasMessages && !window.confirm(t("history.clearConfirm"))) return;
    abortRef.current?.abort();
    void deleteSession(sessionId);
    startNewConversation();
  }, [sessionId, t, startNewConversation]);

  const handleNewConversation = useCallback((): void => {
    abortRef.current?.abort();
    const previous = sessionId;
    if (previous) void deleteSession(previous);
    startNewConversation();
  }, [sessionId, startNewConversation]);

  const handleSelectConversation = useCallback(
    (id: string): void => {
      if (id === sessionId) return;
      abortRef.current?.abort();
      const previous = sessionId;
      if (previous) void deleteSession(previous);

      setActiveConversation(id);
      const convo = useHistoryStore.getState().loadConversation(id);
      if (convo && convo.messages.length > 0) {
        void restoreSession(id, convo.messages);
      }
    },
    [sessionId, setActiveConversation]
  );

  const handleRenameConversation = useCallback(
    (id: string, title: string): void => {
      renameConversation(id, title);
    },
    [renameConversation]
  );

  const handleDeleteConversation = useCallback(
    (id: string): void => {
      abortRef.current?.abort();
      void deleteSession(id);

      const remaining = useHistoryStore
        .getState()
        .listConversations()
        .filter((c) => c.id !== id);
      deleteConversation(id);

      if (id !== sessionId) return;
      const next = remaining[0];
      if (next) {
        setActiveConversation(next.id);
        if (next.messages.length > 0) {
          void restoreSession(next.id, next.messages);
        }
      } else {
        startNewConversation();
      }
    },
    [deleteConversation, sessionId, setActiveConversation, startNewConversation]
  );

  const handleSubmit = useCallback(
    async (text: string): Promise<void> => {
      if (!text.trim() || isStreaming) return;
      setLastUserMessage(text);

      let activeId = sessionId;
      if (!activeId) {
        activeId = startNewConversation();
      }

      console.info("[asistenti.analytics] question", {
        sessionId: activeId,
        locale: useChatStore.getState().sessionId ? "current" : "new",
        length: text.length,
        question: text,
        timestamp: new Date().toISOString(),
      });

      appendUserMessage(text);
      beginStream();

      const controller = new AbortController();
      abortRef.current = controller;

      let finalReceived = false;
      try {
        for await (const chunk of streamChat(
          { message: text, sessionId: activeId },
          controller.signal
        )) {
          if (chunk.type === "token") {
            appendStreamToken(chunk.data);
          } else if (chunk.type === "done") {
            finalReceived = true;
            finalizeStream(chunk.data);
          } else if (chunk.type === "error") {
            failStream(chunk.data);
            return;
          }
        }
        if (!finalReceived) {
          failStream({
            code: "stream_truncated",
            message: t("chat.error"),
          });
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        failStream({
          code: "client_error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [
      appendStreamToken,
      appendUserMessage,
      beginStream,
      failStream,
      finalizeStream,
      isStreaming,
      sessionId,
      startNewConversation,
      t,
    ]
  );

  const handleSuggestion = useCallback(
    (q: string): void => {
      void handleSubmit(q);
    },
    [handleSubmit]
  );

  // Ensure sidebar has an entry even before first message
  useEffect(() => {
    if (sessionId) return;
    if (conversations.length === 0) createConversation();
  }, [sessionId, conversations.length, createConversation]);

  const isEmpty = messages.length === 0 && !isStreaming && !streamingText;

  return (
    <div className="h-[100dvh] flex flex-col md:flex-row bg-bg overflow-hidden">
      <HistorySidebar
        activeId={sessionId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onOpenHistory={() => setDrawerOpen(true)}
          onClearConversation={messages.length > 0 ? handleClearConversation : undefined}
        />

        {isEmpty ? (
          <HeroEmptyState onSelect={handleSuggestion} onSubmit={handleSubmit} />
        ) : (
          <>
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
            >
              <div className="max-w-[720px] mx-auto flex flex-col gap-6">
                {messages.map((m) => (
                  <MessageView
                    key={m.id}
                    message={m}
                    onServiceSelect={handleSubmit}
                  />
                ))}
                {isStreaming && displayStreamingText && (
                  <MessageBubble variant="assistant">
                    <span className="whitespace-pre-wrap">{displayStreamingText}</span>
                    <span className="ml-0.5 inline-block w-[7px] h-[14px] align-[-2px] bg-fg animate-[blink_1s_steps(1,end)_infinite]" />
                  </MessageBubble>
                )}
                {isStreaming && !displayStreamingText && (
                  messages.filter((m) => m.role === "assistant").length === 0
                    ? <MessageSkeleton />
                    : <StreamingDots />
                )}
                {error && !isStreaming && (
                  <ErrorMessage
                    message={error.message || t("chat.error")}
                    onRetry={
                      lastUserMessage
                        ? () => void handleSubmit(lastUserMessage)
                        : undefined
                    }
                  />
                )}
              </div>
            </div>

            <div className="border-t border-border bg-bg px-4 md:px-6 py-3 shrink-0">
              <div className="max-w-[680px] mx-auto">
                <ChatInput
                  onSubmit={handleSubmit}
                  disabled={isStreaming}
                  size="sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <MobileHistoryDrawer
        isOpen={drawerOpen}
        activeId={sessionId}
        onClose={() => setDrawerOpen(false)}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
      />
    </div>
  );
}

function MessageView({
  message,
  onServiceSelect,
}: {
  message: Message;
  onServiceSelect: (query: string) => void;
}): JSX.Element {
  if (message.role === "user") {
    return <MessageBubble variant="user">{message.content}</MessageBubble>;
  }
  if (message.response) {
    return <StepCard response={message.response} onServiceSelect={onServiceSelect} />;
  }
  return <MessageBubble variant="assistant">{message.content}</MessageBubble>;
}

interface HeroProps {
  onSelect: (q: string) => void;
  onSubmit: (text: string) => void;
}

function HeroEmptyState({ onSelect, onSubmit }: HeroProps): JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center px-4 md:px-8 py-12 md:py-20">
        <AssistantMascot />
        <h1 className="text-[36px] md:text-[56px] font-bold tracking-[-0.032em] leading-[1.08] text-center text-fg mb-4 max-w-[680px]">
          {t("app.tagline")}
        </h1>
        <p className="text-[15px] md:text-[17px] text-gray text-center mb-10 max-w-[480px] leading-relaxed">
          {t("app.subtext")}
        </p>
        <div className="w-full max-w-[600px] mb-5">
          <ChatInput onSubmit={onSubmit} size="lg" autoFocus />
        </div>
        <SuggestedQuestions onSelect={onSelect} />
      </div>
    </div>
  );
}

function AssistantMascot(): JSX.Element {
  return (
    <div className="assistant-mascot mb-7" aria-hidden="true">
      <div className="assistant-mascot__antenna" />
      <div className="assistant-mascot__head">
        <div className="assistant-mascot__visor">
          <span />
          <span />
        </div>
        <div className="assistant-mascot__mouth" />
      </div>
      <div className="assistant-mascot__base">
        <div className="assistant-mascot__badge" />
        <div className="assistant-mascot__arm assistant-mascot__arm--left" />
        <div className="assistant-mascot__arm assistant-mascot__arm--right" />
      </div>
    </div>
  );
}
