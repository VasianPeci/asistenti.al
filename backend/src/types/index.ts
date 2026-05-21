export type Locale = "sq" | "en";

export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatSource {
  title: string;
  uri: string;
  snippet?: string;
}

export interface ChatStep {
  title: string;
  description: string;
  documents?: string[];
  estimatedTime?: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  locale?: Locale;
  sessionId?: string;
}

export interface ChatResponse {
  reply: string;
  steps?: ChatStep[];
  sources: ChatSource[];
  locale: Locale;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
