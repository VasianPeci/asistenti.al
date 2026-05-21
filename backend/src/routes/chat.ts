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

function openSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

chatRouter.post("/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
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

  openSse(res);

  let clientClosed = false;
  req.on("close", () => {
    clientClosed = true;
  });

  const safeFail = (logMessage: string, err: unknown): void => {
    logger.error(logMessage, {
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
    if (!res.writableEnded) {
      writeEvent(res, "error", {
        code: "chat_failed",
        message: "Something went wrong. Please try again.",
      });
      res.end();
    }
  };

  try {
    const history = getHistory(sessionId);

    let chunks: RetrievedChunk[] = [];
    try {
      chunks = await retrieve(message, { topK: 4 });
    } catch (err) {
      logger.warn("chat.retrieve.failed", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
      chunks = [];
    }

    if (chunks.length === 0) {
      const fallback = noInfoResponse(message);
      writeEvent(res, "token", fallback.answer);
      writeEvent(res, "done", fallback);
      appendMessages(sessionId, [
        { role: "user", content: message },
        { role: "assistant", content: fallback.answer },
      ]);
      res.end();
      return;
    }

    let accumulated = "";
    try {
      for await (const token of streamChat({
        message,
        history,
        contextChunks: chunks,
      })) {
        if (clientClosed) return;
        accumulated += token;
        writeEvent(res, "token", token);
      }
    } catch (err) {
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

    appendMessages(sessionId, [
      { role: "user", content: message },
      { role: "assistant", content: finalResponse.answer },
    ]);

    res.end();
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
