export type Locale = "al" | "en";

export type Role = "user" | "assistant";

export interface Message {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  response?: AgentResponse;
}

export interface AgentResponse {
  answer: string;
  steps: string[];
  documents: string[];
  source: string | null;
  note?: string | null;
}

export type SseEventType = "token" | "done" | "error";

export interface SseEvent<T = unknown> {
  type: SseEventType;
  data: T;
}

export interface SseErrorPayload {
  code: string;
  message: string;
}
