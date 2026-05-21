import { VertexAI, type Content, type GenerativeModel } from "@google-cloud/vertexai";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { ChatMessage } from "../types";
import type { RetrievedChunk } from "../rag/retriever";
import { buildSystemPrompt } from "./systemPrompt";

let vertex: VertexAI | null = null;

function getVertex(): VertexAI {
  if (!vertex) {
    vertex = new VertexAI({
      project: env.GOOGLE_CLOUD_PROJECT,
      location: env.GOOGLE_CLOUD_LOCATION,
    });
  }
  return vertex;
}

function getModel(systemInstruction: string): GenerativeModel {
  return getVertex().getGenerativeModel({
    model: env.VERTEX_MODEL,
    systemInstruction: { role: "system", parts: [{ text: systemInstruction }] },
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });
}

function formatContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";
  return chunks
    .map(
      (c, i) =>
        `[Document ${i + 1}] source: ${c.source} (similarity ${c.similarity.toFixed(2)})\n${c.text}`
    )
    .join("\n\n---\n\n");
}

function toContent(message: ChatMessage): Content {
  return {
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }],
  };
}

function buildHistory(history: ChatMessage[]): Content[] {
  return history.filter((m) => m.role !== "system").map(toContent);
}

export interface StreamChatOptions {
  message: string;
  history?: ChatMessage[];
  contextChunks?: RetrievedChunk[];
  responseLanguage?: "sq" | "en";
}

export async function* streamChat(
  options: StreamChatOptions
): AsyncGenerator<string, void, void> {
  const { message, history = [], contextChunks = [] } = options;

  const systemInstruction = buildSystemPrompt(
    formatContext(contextChunks),
    options.responseLanguage
  );
  logger.info("gemini.prompt.built", {
    contextChunks: contextChunks.length,
    historyMessages: history.length,
    promptChars: systemInstruction.length,
  });
  const model = getModel(systemInstruction);

  const chat = model.startChat({ history: buildHistory(history) });

  try {
    logger.info("gemini.generation.started", {
      model: env.VERTEX_MODEL,
      messageChars: message.length,
    });
    const result = await chat.sendMessageStream(message);
    logger.info("gemini.stream.opened");
    let sawFirstChunk = false;
    for await (const item of result.stream) {
      const candidates = item.candidates ?? [];
      for (const candidate of candidates) {
        const parts = candidate.content?.parts ?? [];
        for (const part of parts) {
          const text = (part as { text?: string }).text;
          if (typeof text === "string" && text.length > 0) {
            if (!sawFirstChunk) {
              sawFirstChunk = true;
              logger.info("gemini.first_chunk.received", { chars: text.length });
            }
            yield text;
          }
        }
      }
    }
    logger.info("gemini.stream.finished", { receivedChunks: sawFirstChunk });
  } catch (err) {
    const messageText = err instanceof Error ? err.message : String(err);
    logger.error("gemini.stream.failed", { error: messageText });
    throw err;
  }
}

export async function generateChat(options: StreamChatOptions): Promise<string> {
  let full = "";
  for await (const token of streamChat(options)) full += token;
  return full;
}
