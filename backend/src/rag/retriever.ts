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
  corpusName?: string;
}

const DEFAULT_TOP_K = 5;
const RETRIEVE_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    );
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function retrieve(
  query: string,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const normalized = normalizeAlbanian(query);
  if (!normalized) return [];

  const topK = options.topK ?? DEFAULT_TOP_K;

  try {
    const corpusName =
      options.corpusName ??
      env.VERTEX_RAG_CORPUS ??
      (
        await withTimeout(
          getOrCreateCorpus(),
          RETRIEVE_TIMEOUT_MS,
          "getOrCreateCorpus",
        )
      ).name;

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
      "retrieveContexts",
    );

    const contexts = response.contexts?.contexts ?? [];

    const chunks: RetrievedChunk[] = contexts
      .map((ctx) => ({
        text: ctx.text ?? "",
        source: ctx.sourceDisplayName ?? ctx.sourceUri ?? "unknown",
        similarity: typeof ctx.score === "number" ? ctx.score : 0,
      }))
      .filter((c) => c.text.length > 0);

    logger.info("rag.retrieve.result", {
      query: normalized.slice(0, 60),
      rawContexts: contexts.length,
      usableChunks: chunks.length,
      scores: chunks.map((c) => c.similarity),
    });

    // Vertex's retrieveContexts already returns the server-ranked top-K.
    // We do NOT threshold on `score` here: for the default RagManagedDb
    // `score` is a distance (lower = better), so a `>=` cutoff would drop
    // the best matches. topK is the only limit we need.
    return chunks;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error("rag.retrieve.failed", { error: message });
    return [];
  }
}
