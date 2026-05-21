import type {
  AgentResponse,
  Message,
  SseErrorPayload,
  SseEvent,
  SseEventType,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export interface ChatRequestBody {
  message: string;
  sessionId: string;
}

export type StreamChunk =
  | { type: "token"; data: string }
  | { type: "done"; data: AgentResponse }
  | { type: "error"; data: SseErrorPayload };

function parseFrame(raw: string): SseEvent | null {
  const lines = raw.split("\n");
  const dataLine = lines.find((l) => l.startsWith("data:"));
  if (!dataLine) return null;
  const json = dataLine.slice(5).trim();
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as { type?: SseEventType; data?: unknown };
    if (!parsed.type) return null;
    return { type: parsed.type, data: parsed.data };
  } catch {
    return null;
  }
}

function toChunk(event: SseEvent): StreamChunk | null {
  switch (event.type) {
    case "token":
      return typeof event.data === "string"
        ? { type: "token", data: event.data }
        : null;
    case "done":
      return { type: "done", data: event.data as AgentResponse };
    case "error":
      return { type: "error", data: event.data as SseErrorPayload };
    default:
      return null;
  }
}

export async function* streamChat(
  body: ChatRequestBody,
  signal?: AbortSignal,
): AsyncGenerator<StreamChunk, void, void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    yield {
      type: "error",
      data: {
        code: "network_error",
        message: err instanceof Error ? err.message : "Network error",
      },
    };
    return;
  }

  if (!res.ok || !res.body) {
    yield {
      type: "error",
      data: {
        code: "network_error",
        message: `Request failed (${res.status})`,
      },
    };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let doneReceived = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const raw = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const event = parseFrame(raw);
        if (event) {
          const chunk = toChunk(event);
          if (chunk) {
            if (chunk.type === "done") doneReceived = true;
            yield chunk;
            if (chunk.type === "error") return;
          }
        }
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) {
      const event = parseFrame(buffer);
      if (event) {
        const chunk = toChunk(event);
        if (chunk) {
          if (chunk.type === "done") doneReceived = true;
          yield chunk;
          if (chunk.type === "error") return;
        }
      }
    }
    if (!doneReceived) {
      yield {
        type: "error",
        data: {
          code: "stream_truncated",
          message: "The response stream closed before completion.",
        },
      };
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return;
    yield {
      type: "error",
      data: {
        code: "stream_error",
        message: err instanceof Error ? err.message : "Stream failed",
      },
    };
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/session/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    });
  } catch {
    // best-effort cleanup; ignore
  }
}

export interface RestoreMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function restoreSession(
  sessionId: string,
  messages: Message[],
  limit = 6,
): Promise<void> {
  const trimmed: RestoreMessage[] = messages
    .slice(-limit)
    .map((m) => ({ role: m.role, content: m.content }));
  try {
    await fetch(`${API_BASE}/session/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, messages: trimmed }),
    });
  } catch {
    // best-effort; non-fatal
  }
}
