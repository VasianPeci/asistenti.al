import { Router, type Response } from "express";
import { z } from "zod";
import type { ApiErrorBody } from "../types";
import { logger } from "../utils/logger";
import { retrieve, type RetrievedChunk } from "../rag/retriever";
import { friendlySource } from "../rag/sourceMap";
import { streamChat } from "../agent/gemini";
import { parseAgentResponse, type AgentResponse } from "../agent/parser";
import { appendMessages, clearSession, getHistory, setHistory } from "../agent/memory";

export const chatRouter: Router = Router();

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().min(1).max(128),
  locale: z.enum(["sq", "en"]).optional(),
});

type SseEventType = "token" | "done" | "error";

const AI_STREAM_TIMEOUT_MS = 45_000;

class AiGenerationTimeoutError extends Error {
  constructor() {
    super(`AI generation timed out after ${AI_STREAM_TIMEOUT_MS}ms`);
    this.name = "AiGenerationTimeoutError";
  }
}

function isAlbanian(text: string): boolean {
  if (/[ëçËÇ]/.test(text)) return true;
  // Note: dropped "me" and "do" from the spec's keyword list — both are
  // common English words ("do you", "I do", "tell me") and produced
  // false positives that flipped English replies to Albanian.
  const al = /(?:^|[\s\p{P}])(si|te|per|nuk|eshte|kam|ne|dhe|nje|une|ti|ju|ka|ku|kur|sa|cfare)(?=$|[\s\p{P}])/iu;
  return al.test(text);
}

function noInfoResponse(message: string): AgentResponse {
  const sq = isAlbanian(message);
  return sq
    ? {
        answer:
          "Më vjen keq, nuk gjeta informacion të mjaftueshëm në dokumentet tona për këtë pyetje.",
        steps: [],
        documents: [],
        source: null,
        note: "Provoni ta riformuloni pyetjen ose kontaktoni institucionin përkatës.",
      }
    : {
        answer:
          "I'm sorry — I couldn't find enough information in our documents to answer that.",
        steps: [],
        documents: [],
        source: null,
        note: "Try rephrasing your question or contact the relevant institution.",
      };
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

    let chunks: RetrievedChunk[] = [];
    try {
      logger.info("chat.rag.retrieve.started", { sessionId, topK: 4 });
      chunks = await retrieve(message, { topK: 4 });
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

    let accumulated = "";
    logger.info("chat.ai.stream.started", {
      sessionId,
      timeoutMs: AI_STREAM_TIMEOUT_MS,
    });
    const stream = streamChat({
      message,
      history,
      contextChunks: chunks,
    });
    const iterator = stream[Symbol.asyncIterator]();
    const deadline = Date.now() + AI_STREAM_TIMEOUT_MS;
    let sawFirstToken = false;
    try {
      while (true) {
        if (clientClosed) {
          await iterator.return?.();
          return;
        }
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) throw new AiGenerationTimeoutError();
        const next = await nextWithTimeout(iterator.next(), remainingMs);
        if (next.done) break;
        const token = next.value;
        if (!sawFirstToken) {
          sawFirstToken = true;
          logger.info("chat.ai.first_token.received", { sessionId, chars: token.length });
        }
        accumulated += token;
        writeEvent(res, "token", token);
      }
      logger.info("chat.ai.stream.finished", {
        sessionId,
        responseChars: accumulated.length,
      });
    } catch (err) {
      await iterator.return?.().catch((returnErr: unknown) => {
        logger.warn("chat.ai.stream.return_failed", {
          sessionId,
          error: returnErr instanceof Error ? returnErr.message : String(returnErr),
        });
      });
      safeFail("chat.stream.failed", err);
      return;
    }

    const finalResponse = parseAgentResponse(accumulated);
    if (!finalResponse.source) {
      const firstSource = chunks[0]?.source ?? null;
      if (firstSource) finalResponse.source = firstSource;
    }
    if (finalResponse.documents.length === 0) {
      finalResponse.documents = Array.from(new Set(chunks.map((c) => c.source)));
    }

    // documents[] is the list of papers the user needs (ID, photos, etc.),
    // not sources — only map source through friendlySource.
    finalResponse.source = friendlySource(finalResponse.source);

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
