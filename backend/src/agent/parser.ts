export interface AgentResponse {
  answer: string;
  steps: string[];
  documents: string[];
  source: string | null;
  note?: string | null;
}

function stripCodeFences(text: string): string {
  const fence = /^\s*```(?:json)?\s*([\s\S]*?)\s*```\s*$/i.exec(text);
  return fence?.[1]?.trim() ?? text.trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function parseAgentResponse(rawText: string): AgentResponse {
  const cleaned = stripCodeFences(rawText);
  const candidates = [cleaned, extractFirstJsonObject(cleaned) ?? ""];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        const obj = parsed as Record<string, unknown>;
        return {
          answer: typeof obj.answer === "string" ? obj.answer : rawText,
          steps: coerceStringArray(obj.steps),
          documents: coerceStringArray(obj.documents),
          source: typeof obj.source === "string" ? obj.source : null,
          note: typeof obj.note === "string" ? obj.note : null,
        };
      }
    } catch {
      // try next candidate
    }
  }

  return {
    answer: rawText,
    steps: [],
    documents: [],
    source: null,
    note: null,
  };
}
