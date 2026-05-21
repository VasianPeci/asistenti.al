import type { ChatMessage } from "../types";

const MAX_TURNS = 6;
const MAX_MESSAGES = MAX_TURNS * 2;
const TTL_MS = 30 * 60 * 1000;

interface Session {
  messages: ChatMessage[];
  lastTouched: number;
}

const sessions = new Map<string, Session>();

function sweep(now: number): void {
  for (const [id, session] of sessions) {
    if (now - session.lastTouched > TTL_MS) sessions.delete(id);
  }
}

export function getHistory(sessionId: string): ChatMessage[] {
  const now = Date.now();
  sweep(now);
  const session = sessions.get(sessionId);
  if (!session) return [];
  if (now - session.lastTouched > TTL_MS) {
    sessions.delete(sessionId);
    return [];
  }
  return [...session.messages];
}

export function appendMessage(sessionId: string, message: ChatMessage): void {
  const now = Date.now();
  sweep(now);
  const existing = sessions.get(sessionId);
  const messages = existing ? [...existing.messages, message] : [message];
  while (messages.length > MAX_MESSAGES) messages.shift();
  sessions.set(sessionId, { messages, lastTouched: now });
}

export function appendMessages(sessionId: string, batch: ChatMessage[]): void {
  for (const m of batch) appendMessage(sessionId, m);
}

export function setHistory(sessionId: string, messages: ChatMessage[]): void {
  const now = Date.now();
  sweep(now);
  const trimmed = messages.slice(-MAX_MESSAGES);
  sessions.set(sessionId, { messages: trimmed, lastTouched: now });
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function _sessionCountForTest(): number {
  return sessions.size;
}
