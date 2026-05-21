import { create } from "zustand";
import type { AgentResponse, Message, SseErrorPayload } from "../api/types";
import { useHistoryStore } from "./historyStore";

interface ChatState {
  sessionId: string | null;
  messages: Message[];
  isStreaming: boolean;
  streamingText: string;
  error: SseErrorPayload | null;

  startNewConversation: () => string;
  setActiveConversation: (id: string) => void;
  setSessionId: (id: string) => void;
  setMessages: (messages: Message[]) => void;
  clearMessages: () => void;
  appendUserMessage: (content: string) => Message;
  beginStream: () => void;
  appendStreamToken: (token: string) => void;
  finalizeStream: (response: AgentResponse) => Message;
  failStream: (error: SseErrorPayload) => void;
  reset: () => void;
}

function newMessageId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessionId: null,
  messages: [],
  isStreaming: false,
  streamingText: "",
  error: null,

  startNewConversation: () => {
    const id = useHistoryStore.getState().createConversation();
    set({
      sessionId: id,
      messages: [],
      isStreaming: false,
      streamingText: "",
      error: null,
    });
    return id;
  },

  setActiveConversation: (id) => {
    const convo = useHistoryStore.getState().loadConversation(id);
    set({
      sessionId: id,
      messages: convo?.messages ?? [],
      isStreaming: false,
      streamingText: "",
      error: null,
    });
  },

  setSessionId: (id) => set({ sessionId: id }),

  setMessages: (messages) =>
    set({ messages, isStreaming: false, streamingText: "", error: null }),

  clearMessages: () =>
    set({ messages: [], isStreaming: false, streamingText: "", error: null }),

  appendUserMessage: (content) => {
    const sessionId = get().sessionId ?? get().startNewConversation();
    const message: Message = {
      id: newMessageId(),
      role: "user",
      content,
      createdAt: Date.now(),
    };
    set({
      messages: [...get().messages, message],
      error: null,
    });
    useHistoryStore.getState().saveMessage(sessionId, message);
    return message;
  },

  beginStream: () => set({ isStreaming: true, streamingText: "", error: null }),

  appendStreamToken: (token) =>
    set({ streamingText: get().streamingText + token }),

  finalizeStream: (response) => {
    const sessionId = get().sessionId;
    const message: Message = {
      id: newMessageId(),
      role: "assistant",
      content: response.answer,
      createdAt: Date.now(),
      response,
    };
    set({
      messages: [...get().messages, message],
      isStreaming: false,
      streamingText: "",
    });
    if (sessionId) useHistoryStore.getState().saveMessage(sessionId, message);
    return message;
  },

  failStream: (error) =>
    set({ isStreaming: false, streamingText: "", error }),

  reset: () =>
    set({
      sessionId: null,
      messages: [],
      isStreaming: false,
      streamingText: "",
      error: null,
    }),
}));
