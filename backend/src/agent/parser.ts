export interface AgentResponse {
  answer: string;
  steps: string[];
  documents: string[];
  source: string | null;
  note?: string | null;
  services?: SuggestedService[];
  language?: "sq" | "en";
  parseFailed?: boolean;
}

export interface SuggestedService {
  label: string;
  query: string;
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

function coerceOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = cleanLooseString(value);
  return cleaned.trim().toLowerCase() === "null" ? null : cleaned;
}

function cleanLooseString(value: string): string {
  return value
    .split(/\r?\n/)[0]!
    .replace(/\bCohere\b/gi, "")
    .replace(/,\s*"?(answer|steps|documents|source|note|services|language|parseFailed)"?\s*:.*$/i, "")
    .replace(/["\]}{,[\s]+$/g, "")
    .trim();
}

function extractJsonStringField(text: string, field: string): string | null {
  const startMatch = new RegExp(`"${field}"\\s*:\\s*"`).exec(text);
  if (!startMatch) return null;
  const start = startMatch.index + startMatch[0].length;
  const delimiters = ['",\n  "', '",\r\n  "', '","', '"\n}', '"\r\n}', '"}'];
  const ends = delimiters
    .map((delimiter) => {
      const index = text.indexOf(delimiter, start);
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    })
    .filter((index) => Number.isFinite(index));
  if (ends.length === 0) return null;
  return cleanLooseString(text.slice(start, Math.min(...ends)).replace(/\\"/g, '"'));
}

function splitLooseArrayItems(raw: string): string[] {
  return raw
    .split(/",\s*"/)
    .map((item) =>
      cleanLooseString(
        item
          .replace(/^\s*"/, "")
          .replace(/"\s*$/, "")
          .replace(/\\"/g, '"')
      )
    )
    .filter(Boolean);
}

function extractJsonArrayField(text: string, field: string): string[] {
  const startMatch = new RegExp(`"${field}"\\s*:\\s*\\[`).exec(text);
  if (!startMatch) return [];
  const start = startMatch.index + startMatch[0].length;
  const end = text.indexOf(`],`, start) === -1 ? text.indexOf(`]\n`, start) : text.indexOf(`],`, start);
  const fallbackEnd = text.indexOf("]", start);
  const arrayEnd = end === -1 ? fallbackEnd : end;
  if (arrayEnd === -1) return [];
  return splitLooseArrayItems(text.slice(start, arrayEnd));
}

function parseLooseAgentResponse(rawText: string, responseLanguage: "sq" | "en"): AgentResponse | null {
  const cleaned = stripCodeFences(rawText);
  const answer = extractJsonStringField(cleaned, "answer");
  const steps = extractJsonArrayField(cleaned, "steps");
  const documents = extractJsonArrayField(cleaned, "documents");
  const source = extractJsonStringField(cleaned, "source");
  const note = extractJsonStringField(cleaned, "note");

  if (!answer && steps.length === 0) return null;

  return {
    answer: answer ?? (responseLanguage === "sq" ? "Përgjigjja u krijua nga dokumentet e gjetura." : "The answer was created from the retrieved documents."),
    steps,
    documents,
    source,
    note: coerceOptionalString(note),
    services: [],
    language: responseLanguage,
    parseFailed: false,
  };
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.includes('"answer"');
}

export function parseAgentResponse(rawText: string, responseLanguage: "sq" | "en" = "en"): AgentResponse {
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
          note: coerceOptionalString(obj.note),
          services: [],
          language: responseLanguage,
          parseFailed: false,
        };
      }
    } catch {
      // try next candidate
    }
  }

  const loose = parseLooseAgentResponse(rawText, responseLanguage);
  if (loose) return loose;

  return {
    answer: looksLikeJson(rawText)
      ? responseLanguage === "sq"
        ? "Nuk arrita ta formatoj përgjigjen si duhet. Ju lutemi provoni përsëri me një pyetje më specifike për shërbimin."
        : "I could not format the response correctly. Please try asking again with a more specific service question."
      : rawText,
    steps: [],
    documents: [],
    source: null,
    note: null,
    services: [],
    language: responseLanguage,
    parseFailed: true,
  };
}
