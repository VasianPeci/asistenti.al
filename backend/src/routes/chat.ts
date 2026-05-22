import { Router, type Response } from "express";
import { z } from "zod";
import type { ApiErrorBody } from "../types";
import { logger } from "../utils/logger";
import { retrieve, type RetrievedChunk } from "../rag/retriever";
import { mergeRetrievedChunks, retrievePinnedServiceChunks } from "../rag/localGrounding";
import { friendlySource } from "../rag/sourceMap";
import { streamChat } from "../agent/gemini";
import {
  parseAgentResponse,
  type AgentResponse,
  type StepChannel,
  type StepDetail,
  type StepDifficulty,
  type SuggestedService,
} from "../agent/parser";
import { appendMessages, clearSession, getHistory, setHistory } from "../agent/memory";

export const chatRouter: Router = Router();

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(128),
  locale: z.enum(["sq", "en"]).optional(),
});

type SseEventType = "token" | "done" | "error";

const AI_STREAM_TIMEOUT_MS = 45_000;
const STREAMING_ANSWER_PATTERN = /"answer"\s*:\s*"((?:[^"\\]|\\.)*)/;
const JSON_ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
};

class AiGenerationTimeoutError extends Error {
  constructor() {
    super(`AI generation timed out after ${AI_STREAM_TIMEOUT_MS}ms`);
    this.name = "AiGenerationTimeoutError";
  }
}

function normalizeMessageText(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[!?.,"'()[\]{}:;]+/g, "")
    .replace(/\s+/g, " ");
}

function unescapeJsonString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i += 1) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1]!;
      const mapped = JSON_ESCAPE_MAP[next];
      if (mapped !== undefined) {
        out += mapped;
        i += 1;
        continue;
      }
      if (next === "u" && i + 5 < raw.length) {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
      }
    }
    out += ch;
  }
  return out;
}

function extractStreamingAnswer(buffer: string): string {
  const match = STREAMING_ANSWER_PATTERN.exec(buffer);
  if (!match || match[1] === undefined) return "";
  return unescapeJsonString(match[1]);
}

function detectResponseLanguage(text: string): "sq" | "en" {
  const normalized = normalizeMessageText(text);
  if (
    /\b(si|cfare|cafe|ku|kur|sa|dua|duhet|mund|aplikoj|rinovoj|marr|kerkoj|dokument\w*|nevojiten|certifikat\w*|lindj\w*|vdekj\w*|vdekje|deshmi|penalitet|pasaport\w*|martes\w*|qendrim\w*|automjet\w*|pershendetj\w*|hej+|tung|ckemi|miredita|miremengjes|mirembrema)\b/u.test(
      normalized
    )
  ) {
    return "sq";
  }
  if (/[ëçËÇ]/.test(text)) return "sq";
  return "en";
}

function isAlbanian(text: string): boolean {
  if (/[ëçËÇ]/.test(text)) return true;
  // Note: dropped "me" and "do" from the spec's keyword list — both are
  // common English words ("do you", "I do", "tell me") and produced
  // false positives that flipped English replies to Albanian.
  const al = /(?:^|[\s\p{P}])(si|te|per|nuk|eshte|kam|ne|dhe|nje|une|ti|ju|ka|ku|kur|sa|cfare)(?=$|[\s\p{P}])/iu;
  return al.test(normalizeMessageText(text));
}

function isGreeting(text: string): boolean {
  const normalized = normalizeMessageText(text);

  if (!normalized) return false;
  if (/^(hello+|hey+|hi+|hej+|pershendetje+|tung+|ckemi+)$/.test(normalized)) return true;

  const greetings = new Set([
    "hi",
    "hello",
    "hey",
    "hej",
    "good morning",
    "good afternoon",
    "good evening",
    "pershendetje",
    "tung",
    "ckemi",
    "miremengjes",
    "miredita",
    "mirembrema",
  ]);

  return greetings.has(normalized);
}

function isAlbanianGreeting(text: string): boolean {
  const normalized = normalizeMessageText(text);
  if (/^(hej+|pershendetje+|tung+|ckemi+)$/.test(normalized)) return true;

  return new Set([
    "hej",
    "pershendetje",
    "tung",
    "ckemi",
    "miremengjes",
    "miredita",
    "mirembrema",
  ]).has(normalized);
}

function hasServiceIntent(text: string): boolean {
  const normalized = normalizeMessageText(text);
  if (!normalized) return false;

  const serviceKeywords = [
    "passport",
    "pasaport",
    "identity",
    "id card",
    "karte identitet",
    "karta identitet",
    "birth certificate",
    "certifikat lindj",
    "certifikate lindj",
    "certifikaten e lindjes",
    "akti i lindjes",
    "death certificate",
    "certifikat vdekj",
    "certifikate vdekj",
    "certifikaten e vdekjes",
    "akti i vdekjes",
    "vdekje",
    "criminal record",
    "deshmi penalitet",
    "penalitet",
    "business",
    "biznes",
    "nipt",
    "tax",
    "tatim",
    "driver",
    "license",
    "licence",
    "patent",
    "leje drejtimi",
    "lejen e drejtimit",
    "vehicle",
    "car registration",
    "automjet",
    "residence",
    "leje qendrimi",
    "qendrim",
    "marriage",
    "martes",
    "martese",
    "regjistrim martese",
    "dokumente per martese",
    "dokumentesh nevojiten per martese",
    "diploma",
    "diplome",
    "matura",
    "pension",
    "punesim",
    "employment",
  ];

  return serviceKeywords.some((keyword) => normalized.includes(keyword));
}

function buildRetrievalQuery(message: string, history: ReturnType<typeof getHistory>): string {
  const recent = history
    .slice(-4)
    .map((entry) => entry.content)
    .join(" ");
  return `${recent} ${message}`.trim();
}

function asksOnlyForDocuments(text: string): boolean {
  const normalized = normalizeMessageText(text);
  return (
    /\b(documents?|documentacion|dokument\w*)\b/u.test(normalized) &&
    !/\b(how|steps?|apply|complete|process|si|hapat|aplikoj|kryej)\b/u.test(normalized)
  );
}

function asksForSingleDetail(text: string): boolean {
  const normalized = normalizeMessageText(text);
  return /\b(format|size|photo|foto|fotografi|cm|jpg|jpeg|png|tarif|fee|cost|kosto|pages|time|kohe|processing)\b/u.test(
    normalized
  );
}

function keepOnlyRequestedScope(response: AgentResponse, message: string): AgentResponse {
  if (asksOnlyForDocuments(message) || asksForSingleDetail(message)) {
    response.steps = [];
    response.stepDetails = [];
  }
  if (asksForSingleDetail(message) && !asksOnlyForDocuments(message)) {
    response.documents = [];
  }
  return response;
}

function inferStepChannel(step: string): StepChannel {
  const normalized = normalizeMessageText(step);
  const digitalWords = /\b(online|portal|e-albania|aplikim elektronik|elektronik|login|account|llogari|upload|ngarko|submit|dergo|form|formular)\b/u;
  const manualWords = /\b(office|zyre|paraqit|fizik|personalisht|sportel|appointment|takim|coupon|kupon|print|scan|signed|nenshkruar)\b/u;
  const digital = digitalWords.test(normalized);
  const manual = manualWords.test(normalized);
  if (digital && manual) return "hybrid";
  if (manual) return "manual";
  return "digital";
}

function inferStepDifficulty(step: string, channel: StepChannel): StepDifficulty {
  const normalized = normalizeMessageText(step);
  if (
    /\b(court|gjykat|prokur|noter|power of attorney|prokure|authorization|autorizim|multiple|disa|appeal|ankim|verification|verifikim)\b/u.test(
      normalized
    )
  ) {
    return "hard";
  }
  if (
    channel === "manual" ||
    /\b(payment|pagese|fee|tarif|appointment|takim|wait|prit|working days|dite pune|documents?|dokument|upload|ngarko)\b/u.test(
      normalized
    )
  ) {
    return "medium";
  }
  return "easy";
}

function ensureStepDetails(response: AgentResponse): AgentResponse {
  if (response.steps.length === 0) {
    response.stepDetails = [];
    return response;
  }

  if (response.stepDetails?.length === response.steps.length) return response;

  response.stepDetails = response.steps.map((step): StepDetail => {
    const channel = inferStepChannel(step);
    return {
      channel,
      difficulty: inferStepDifficulty(step, channel),
      note: null,
    };
  });
  return response;
}

function serviceMenuResponse(message: string, reason: "greeting" | "unknown"): AgentResponse {
  const sq = detectResponseLanguage(message) === "sq" || isAlbanianGreeting(message);
  const services: SuggestedService[] = sq
    ? [
        { label: "Rinovimi i pasaportës", query: "Si të rinovoj pasaportën?" },
        { label: "Aplikimi për kartë identiteti", query: "Si të aplikoj për kartë identiteti?" },
        { label: "Certifikatë lindjeje", query: "Si të marr certifikatën e lindjes?" },
        { label: "Certifikatë vdekjeje", query: "Si të marr certifikatën e vdekjes?" },
        { label: "Dëshmi penaliteti", query: "Si të marr dëshmi penaliteti?" },
        { label: "Regjistrimi i biznesit dhe NIPT", query: "Si të regjistroj biznesin dhe të marr NIPT?" },
        { label: "Vërtetim për lejen e drejtimit", query: "Si të marr vërtetim për lejen e drejtimit?" },
        { label: "Regjistrim automjeti", query: "Si të regjistroj automjetin?" },
        { label: "Leje qëndrimi", query: "Si të marr leje qëndrimi?" },
      ]
    : [
        { label: "Passport renewal", query: "How do I renew my passport?" },
        { label: "Identity card application", query: "How do I apply for an identity card?" },
        { label: "Birth certificate", query: "How do I get a birth certificate?" },
        { label: "Death certificate", query: "How do I get a death certificate?" },
        { label: "Criminal record certificate", query: "How do I get a criminal record certificate?" },
        { label: "Business registration and NIPT", query: "How do I register a business and get NIPT?" },
        { label: "Driver's license certificate", query: "How do I get a driver's license certificate?" },
        { label: "Vehicle registration", query: "How do I register a vehicle?" },
        { label: "Residence permit", query: "How do I get a residence permit?" },
      ];
  return sq
    ? {
        answer:
          reason === "greeting"
            ? "Përshëndetje! Mund t'ju ndihmoj me udhëzime për shërbime publike në Shqipëri. Zgjidhni një nga temat më poshtë ose shkruani pyetjen tuaj."
            : "Përshëndetje! Mund t'ju ndihmoj vetëm me shërbime publike në Shqipëri. Nuk e identifikova shërbimin nga mesazhi juaj; zgjidhni një nga temat më poshtë ose shkruani një pyetje më specifike.",
        steps: [],
        documents: [],
        source: null,
        note: null,
        services,
        language: "sq",
      }
    : {
        answer:
          reason === "greeting"
            ? "Hello! I can help with guidance for Albanian public services. Choose one of the topics below or ask your question."
            : "Hello! I can only help with Albanian public services. I could not identify a service from your message; choose one of the topics below or ask a more specific question.",
        steps: [],
        documents: [],
        source: null,
        note: null,
        services,
        language: "en",
      };
}

function noInfoResponse(message: string): AgentResponse {
  const sq = detectResponseLanguage(message) === "sq";
  return sq
    ? {
        answer:
          "Më vjen keq, nuk gjeta informacion të mjaftueshëm në dokumentet tona për këtë pyetje.",
        steps: [],
        documents: [],
        source: null,
        note: "Provoni ta riformuloni pyetjen ose kontaktoni institucionin përkatës.",
        services: [],
        language: "sq",
      }
    : {
        answer:
          "I'm sorry — I couldn't find enough information in our documents to answer that.",
        steps: [],
        documents: [],
        source: null,
        note: "Try rephrasing your question or contact the relevant institution.",
        services: [],
        language: "en",
      };
}

function isNoInfoAnswer(response: AgentResponse): boolean {
  if (response.source?.trim().toLowerCase() === "no info") return true;
  if (response.steps.length > 0) return false;

  const text = normalizeMessageText([response.answer, response.note ?? "", response.source ?? ""].join(" "));
  return (
    text.includes("no info") ||
    text.includes("do not have information") ||
    text.includes("dont have information") ||
    text.includes("cannot find any information") ||
    text.includes("could not find enough information") ||
    text.includes("nuk gjendet") ||
    text.includes("nuk e gjeta") ||
    text.includes("nuk gjeta informacion") ||
    text.includes("nuk kam informacion")
  );
}

function looksLikeJsonFragment(value: string): boolean {
  return /^"?(channel|difficulty|note|stepDetails)"?\s*:/i.test(value.trim());
}

function cleanFinalResponse(response: AgentResponse): AgentResponse {
  if (response.parseFailed) {
    response.documents = [];
    response.stepDetails = [];
    response.source = null;
    return response;
  }
  if (isNoInfoAnswer(response)) {
    response.documents = [];
    response.stepDetails = [];
    response.source = null;
    return response;
  }

  response.steps = response.steps.filter((step) => !looksLikeJsonFragment(step));
  if (response.stepDetails?.length !== response.steps.length) {
    response.stepDetails = [];
  }
  response.documents = response.documents.filter((document) => !/\.txt$/i.test(document.trim()));
  if (response.source?.trim().toLowerCase() === "no info") response.source = null;
  return response;
}

function writeEvent(res: Response, type: SseEventType, data: unknown): void {
  res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
}

async function nextWithTimeout<T>(
  next: Promise<IteratorResult<T>>,
  remainingMs: number
): Promise<IteratorResult<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiGenerationTimeoutError()), remainingMs);
  });
  try {
    return await Promise.race([next, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkAnswerDelta(delta: string): string[] {
  const parts = delta.match(/\S+\s*/g);
  if (!parts) return delta ? [delta] : [];
  const chunks: string[] = [];
  let current = "";

  for (const part of parts) {
    if ((current + part).length > 28 && current) {
      chunks.push(current);
      current = part;
    } else {
      current += part;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function collectAiResponseWithTimeout(options: {
  message: string;
  history: ReturnType<typeof getHistory>;
  contextChunks: RetrievedChunk[];
  responseLanguage: "sq" | "en";
  sessionId: string;
  clientClosed: () => boolean;
  onAnswerToken?: (token: string) => void | Promise<void>;
}): Promise<string | null> {
  let accumulated = "";
  let streamedAnswerChars = 0;
  logger.info("chat.ai.stream.started", {
    sessionId: options.sessionId,
    timeoutMs: AI_STREAM_TIMEOUT_MS,
  });
  const stream = streamChat({
    message: options.message,
    history: options.history,
    contextChunks: options.contextChunks,
    responseLanguage: options.responseLanguage,
  });
  const iterator = stream[Symbol.asyncIterator]();
  const deadline = Date.now() + AI_STREAM_TIMEOUT_MS;
  let sawFirstToken = false;

  try {
    while (true) {
      if (options.clientClosed()) {
        await iterator.return?.();
        return null;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) throw new AiGenerationTimeoutError();
      const next = await nextWithTimeout(iterator.next(), remainingMs);
      if (next.done) break;
      const token = next.value;
      if (!sawFirstToken) {
        sawFirstToken = true;
        logger.info("chat.ai.first_token.received", {
          sessionId: options.sessionId,
          chars: token.length,
        });
      }
      accumulated += token;
      if (options.onAnswerToken) {
        const answer = extractStreamingAnswer(accumulated);
        if (answer.length > streamedAnswerChars) {
          const delta = answer.slice(streamedAnswerChars);
          streamedAnswerChars = answer.length;
          await options.onAnswerToken(delta);
        }
      }
    }
    logger.info("chat.ai.stream.finished", {
      sessionId: options.sessionId,
      responseChars: accumulated.length,
    });
    return accumulated;
  } catch (err) {
    await iterator.return?.().catch((returnErr: unknown) => {
      logger.warn("chat.ai.stream.return_failed", {
        sessionId: options.sessionId,
        error: returnErr instanceof Error ? returnErr.message : String(returnErr),
      });
    });
    throw err;
  }
}

function openSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

chatRouter.post("/chat", async (req, res) => {
  logger.info("chat.request.received", {
    hasBody: typeof req.body === "object" && req.body !== null,
  });
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    logger.warn("chat.request.invalid", { issues: parsed.error.issues });
    const body: ApiErrorBody = {
      error: {
        code: "invalid_request",
        message: "Invalid chat request body",
        details: parsed.error.issues,
      },
    };
    res.status(400).json(body);
    return;
  }

  const { message, sessionId } = parsed.data;
  const responseLanguage = detectResponseLanguage(message);
  logger.info("chat.request.valid", { sessionId, messageChars: message.length });

  openSse(res);

  let clientClosed = false;
  res.on("close", () => {
    if (!res.writableEnded) {
      clientClosed = true;
      logger.info("chat.client.closed", { sessionId });
    }
  });

  const safeFail = (logMessage: string, err: unknown): void => {
    const timedOut = err instanceof AiGenerationTimeoutError;
    logger.error(logMessage, {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    if (!res.writableEnded) {
      writeEvent(res, "error", {
        code: timedOut ? "ai_timeout" : "chat_failed",
        message: timedOut
          ? "The AI response timed out. Please try again."
          : "Something went wrong. Please try again.",
      });
      logger.info("chat.response.error_sent", { sessionId });
      res.end();
      logger.info("chat.response.ended", { sessionId });
    }
  };

  try {
    const history = getHistory(sessionId);

    if (isGreeting(message)) {
      logger.info("chat.greeting.detected", { sessionId });
      const response = serviceMenuResponse(message, "greeting");
      writeEvent(res, "token", response.answer);
      writeEvent(res, "done", response);
      logger.info("chat.response.done_sent", { sessionId, fallback: true, greeting: true });
      appendMessages(sessionId, [
        { role: "user", content: message },
        { role: "assistant", content: response.answer },
      ]);
      res.end();
      logger.info("chat.response.ended", { sessionId });
      return;
    }

    const retrievalQuery = buildRetrievalQuery(message, history);
    if (!hasServiceIntent(retrievalQuery)) {
      logger.info("chat.service_intent.not_identified", { sessionId });
      const response = serviceMenuResponse(message, "unknown");
      writeEvent(res, "token", response.answer);
      writeEvent(res, "done", response);
      logger.info("chat.response.done_sent", {
        sessionId,
        fallback: true,
        serviceIntent: false,
      });
      appendMessages(sessionId, [
        { role: "user", content: message },
        { role: "assistant", content: response.answer },
      ]);
      res.end();
      logger.info("chat.response.ended", { sessionId });
      return;
    }

    const pinnedChunks = retrievePinnedServiceChunks(retrievalQuery);
    let chunks: RetrievedChunk[] = pinnedChunks;
    try {
      logger.info("chat.rag.retrieve.started", { sessionId, topK: 4 });
      const ragChunks = await retrieve(retrievalQuery, { topK: 4 });
      chunks = mergeRetrievedChunks(pinnedChunks, ragChunks);
      logger.info("chat.rag.retrieve.finished", { sessionId, chunks: chunks.length });
    } catch (err) {
      logger.warn("chat.retrieve.failed", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      chunks = [];
      logger.info("chat.rag.retrieve.finished", { sessionId, chunks: 0, failed: true });
    }

    if (chunks.length === 0) {
      const fallback = noInfoResponse(message);
      writeEvent(res, "token", fallback.answer);
      writeEvent(res, "done", fallback);
      logger.info("chat.response.done_sent", { sessionId, fallback: true });
      appendMessages(sessionId, [
        { role: "user", content: message },
        { role: "assistant", content: fallback.answer },
      ]);
      res.end();
      logger.info("chat.response.ended", { sessionId });
      return;
    }

    let accumulated: string | null;
    try {
      accumulated = await collectAiResponseWithTimeout({
        message,
        history,
        contextChunks: chunks,
        responseLanguage,
        sessionId,
        clientClosed: () => clientClosed,
        onAnswerToken: async (token) => {
          for (const chunk of chunkAnswerDelta(token)) {
            if (clientClosed || res.writableEnded) return;
            writeEvent(res, "token", chunk);
            await sleep(18);
          }
        },
      });
    } catch (err) {
      safeFail("chat.stream.failed", err);
      return;
    }
    if (accumulated === null) return;

    let finalResponse = parseAgentResponse(accumulated, responseLanguage);
    if (finalResponse.parseFailed) {
      logger.warn("chat.ai.parse_failed.retrying", {
        sessionId,
        rawPreview: accumulated.slice(0, 240),
      });
      const retryMessage = [
        message,
        "",
        "Your previous response was not valid JSON.",
        "Return the answer again as one valid JSON object only.",
        "Do not use quotation marks inside string values; use plain words for button names.",
        "Do not include markdown or text outside JSON.",
      ].join("\n");
      try {
        const retryAccumulated = await collectAiResponseWithTimeout({
          message: retryMessage,
          history,
          contextChunks: chunks,
          responseLanguage,
          sessionId,
          clientClosed: () => clientClosed,
        });
        if (retryAccumulated === null) return;
        finalResponse = parseAgentResponse(retryAccumulated, responseLanguage);
      } catch (err) {
        safeFail("chat.retry_stream.failed", err);
        return;
      }
    }
    finalResponse.language = responseLanguage;
    keepOnlyRequestedScope(finalResponse, message);
    cleanFinalResponse(finalResponse);
    ensureStepDetails(finalResponse);

    if (!finalResponse.source && !isNoInfoAnswer(finalResponse)) {
      const firstSource = chunks[0]?.source ?? null;
      if (firstSource) finalResponse.source = firstSource;
    }

    // documents[] is the list of papers the user needs (ID, photos, etc.),
    // not sources — only map source through friendlySource.
    finalResponse.source = friendlySource(finalResponse.source);
    cleanFinalResponse(finalResponse);

    writeEvent(res, "done", finalResponse);
    logger.info("chat.response.done_sent", { sessionId, fallback: false });

    appendMessages(sessionId, [
      { role: "user", content: message },
      { role: "assistant", content: finalResponse.answer },
    ]);

    res.end();
    logger.info("chat.response.ended", { sessionId });
  } catch (err) {
    safeFail("chat.unexpected", err);
  }
});

const RestoreRequestSchema = z.object({
  sessionId: z.string().min(1).max(128),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "system"]),
        content: z.string().min(1),
      })
    )
    .max(50),
});

chatRouter.post("/session/restore", (req, res) => {
  const parsed = RestoreRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const body: ApiErrorBody = {
      error: {
        code: "invalid_request",
        message: "Invalid restore request body",
        details: parsed.error.issues,
      },
    };
    res.status(400).json(body);
    return;
  }
  setHistory(parsed.data.sessionId, parsed.data.messages);
  res.json({ ok: true, sessionId: parsed.data.sessionId, restored: parsed.data.messages.length });
});

chatRouter.delete("/session/:id", (req, res) => {
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: { code: "invalid_request", message: "session id required" } });
    return;
  }
  clearSession(id);
  res.json({ ok: true, sessionId: id });
});
