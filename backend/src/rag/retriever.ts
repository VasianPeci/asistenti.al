import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getRagServiceClient, locationPath } from "./client";
import { getOrCreateCorpus } from "./corpus";
import { normalizeAlbanian } from "./normalize";

export interface RetrievedChunk {
  text: string;
  source: string;
  similarity: number;
}

export interface RetrieveOptions {
  topK?: number;
  minSimilarity?: number;
  corpusName?: string;
}

const DEFAULT_TOP_K = 5;
const DEFAULT_MIN_SIMILARITY = 0.6;
const RETRIEVE_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export async function retrieve(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const normalized = normalizeAlbanian(query);
  if (!normalized) return [];

  const topK = options.topK ?? DEFAULT_TOP_K;
  const minSimilarity = options.minSimilarity ?? DEFAULT_MIN_SIMILARITY;

  try {
    const corpusName =
      options.corpusName ??
      env.VERTEX_RAG_CORPUS ??
      (await withTimeout(getOrCreateCorpus(), RETRIEVE_TIMEOUT_MS, "getOrCreateCorpus")).name;

    const client = getRagServiceClient();
    const [response] = await withTimeout(
      client.retrieveContexts({
        parent: locationPath(),
        query: {
          text: normalized,
          ragRetrievalConfig: { topK },
        },
        vertexRagStore: {
          ragResources: [{ ragCorpus: corpusName }],
        },
      }),
      RETRIEVE_TIMEOUT_MS,
      "retrieveContexts"
    );

    const contexts = response.contexts?.contexts ?? [];
    const chunks: RetrievedChunk[] = contexts
      .map((ctx) => {
        const similarity =
          typeof ctx.score === "number"
            ? ctx.score
            : typeof ctx.distance === "number"
              ? 1 - ctx.distance
              : 0;
        return {
          text: ctx.text ?? "",
          source: ctx.sourceDisplayName ?? ctx.sourceUri ?? "unknown",
          similarity,
        };
      })
      .filter((c) => c.text.length > 0 && c.similarity >= minSimilarity);

    return chunks;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("rag.retrieve.failed", { error: message });
    return [];
  }
}
