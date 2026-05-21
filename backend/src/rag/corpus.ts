import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getRagDataClient, locationPath } from "./client";

const DEFAULT_CORPUS_DISPLAY_NAME = "asistenti-al-corpus";

export interface CorpusInfo {
  name: string;
  displayName: string;
}

export interface RagFileInfo {
  name: string;
  displayName: string;
}

export async function getOrCreateCorpus(
  displayName: string = DEFAULT_CORPUS_DISPLAY_NAME
): Promise<CorpusInfo> {
  if (env.VERTEX_RAG_CORPUS) {
    return { name: env.VERTEX_RAG_CORPUS, displayName };
  }

  const client = getRagDataClient();
  const parent = locationPath();

  const [existing] = await client.listRagCorpora({ parent });
  const match = existing.find((c) => c.displayName === displayName);
  if (match?.name) {
    logger.info("rag.corpus.reused", { name: match.name, displayName });
    return { name: match.name, displayName };
  }

  logger.info("rag.corpus.creating", { displayName });
  const [operation] = await client.createRagCorpus({
    parent,
    ragCorpus: { displayName },
  });
  const [created] = await operation.promise();
  if (!created.name) {
    throw new Error("createRagCorpus returned a corpus without a name");
  }
  logger.info("rag.corpus.created", { name: created.name });
  return { name: created.name, displayName };
}

export async function listRagFiles(corpusName: string): Promise<RagFileInfo[]> {
  const client = getRagDataClient();
  const [files] = await client.listRagFiles({ parent: corpusName });
  return files
    .filter((f): f is { name: string; displayName: string } =>
      Boolean(f.name && f.displayName)
    )
    .map((f) => ({ name: f.name, displayName: f.displayName }));
}
