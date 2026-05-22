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
  services?: SuggestedService[];
  stepDetails?: StepDetail[];
  language?: "sq" | "en";
  parseFailed?: boolean;
}

export type StepDifficulty = "easy" | "medium" | "hard";
export type StepChannel = "digital" | "manual" | "hybrid";

export interface StepDetail {
  difficulty: StepDifficulty;
  channel: StepChannel;
  note?: string | null;
}

export interface SuggestedService {
  label: string;
  query: string;
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
