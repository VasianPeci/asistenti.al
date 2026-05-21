import { create } from "zustand";
import type { Message } from "../api/types";

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  locale?: "al" | "en";
}

const STORAGE_KEY = "asistenti_history";
const LOCALE_STORAGE_KEY = "asistenti_locale";
const MAX_CONVERSATIONS = 20;
const TITLE_MAX = 60;

function safeRead(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const conversations = parsed.filter(isConversation);
    const migrated = conversations.map((c) =>
      c.locale ? c : { ...c, locale: currentLocale() }
    );
    if (migrated.some((c, i) => c !== conversations[i])) safeWrite(migrated);
    return migrated;
  } catch {
    return [];
  }
}

function safeWrite(conversations: Conversation[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // private mode or quota — fall back to in-memory only
  }
}

function isConversation(value: unknown): value is Conversation {
  if (!value || typeof value !== "object") return false;
  const c = value as Partial<Conversation>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    Array.isArray(c.messages) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number"
  );
}

function truncateTitle(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length <= TITLE_MAX) return trimmed;
  return `${trimmed.slice(0, TITLE_MAX - 1).trimEnd()}…`;
}

function currentLocale(): "al" | "en" {
  try {
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    return raw === "en" ? "en" : "al";
  } catch {
    return "al";
  }
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function pruneAndSort(list: Conversation[]): Conversation[] {
  const sorted = [...list].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, MAX_CONVERSATIONS);
}

interface HistoryState {
  conversations: Conversation[];
  createConversation: () => string;
  saveMessage: (id: string, message: Message) => void;
  loadConversation: (id: string) => Conversation | null;
  listConversations: () => Conversation[];
  renameConversation: (id: string, title: string) => void;
  deleteConversation: (id: string) => void;
  clearAll: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  conversations: safeRead(),

  createConversation: () => {
    const now = Date.now();
    const convo: Conversation = {
      id: newId(),
      title: "",
      messages: [],
      createdAt: now,
      updatedAt: now,
      locale: currentLocale(),
    };
    const next = pruneAndSort([convo, ...get().conversations]);
    safeWrite(next);
    set({ conversations: next });
    return convo.id;
  },

  saveMessage: (id, message) => {
    const list = get().conversations;
    const index = list.findIndex((c) => c.id === id);
    if (index === -1) return;
    const existing = list[index]!;
    const messages = [...existing.messages, message];
    const title =
      existing.title ||
      (message.role === "user" ? truncateTitle(message.content) : existing.title);
    const updated: Conversation = {
      ...existing,
      messages,
      title,
      updatedAt: Date.now(),
    };
    const next = pruneAndSort([updated, ...list.filter((c) => c.id !== id)]);
    safeWrite(next);
    set({ conversations: next });
  },

  loadConversation: (id) => get().conversations.find((c) => c.id === id) ?? null,

  listConversations: () =>
    [...get().conversations].sort((a, b) => b.updatedAt - a.updatedAt),

  renameConversation: (id, title) => {
    const trimmed = truncateTitle(title);
    if (!trimmed) return;
    const next = get().conversations.map((c) =>
      c.id === id ? { ...c, title: trimmed, updatedAt: Date.now() } : c
    );
    const sorted = pruneAndSort(next);
    safeWrite(sorted);
    set({ conversations: sorted });
  },

  deleteConversation: (id) => {
    const next = get().conversations.filter((c) => c.id !== id);
    safeWrite(next);
    set({ conversations: next });
  },

  clearAll: () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    set({ conversations: [] });
  },
}));
