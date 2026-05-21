import { promises as fs } from "node:fs";
import * as path from "node:path";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import { getAuth } from "./client";
import { getOrCreateCorpus, listRagFiles, type CorpusInfo } from "./corpus";
import { normalizeAlbanian } from "./normalize";

export interface IngestResult {
  corpus: CorpusInfo;
  uploaded: string[];
  skipped: string[];
  failed: Array<{ file: string; error: string }>;
}

function displayNameForFile(filePath: string): string {
  return path.basename(filePath);
}

async function uploadRagFile(
  corpusName: string,
  filePath: string,
  displayName: string
): Promise<void> {
  const accessToken = await getAuth().getAccessToken();
  if (!accessToken) throw new Error("Failed to obtain GCP access token");

  const raw = await fs.readFile(filePath, "utf8");
  const normalized = normalizeAlbanian(raw);

  const uploadUrl =
    `https://${env.GOOGLE_CLOUD_LOCATION}-aiplatform.googleapis.com` +
    `/upload/v1beta1/${corpusName}/ragFiles:upload`;

  const boundary = `----asistenti-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const metadata = {
    rag_file: {
      display_name: displayName,
      description: `Ingested from ${displayName}`,
    },
  };

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${normalized}\r\n` +
    `--${boundary}--\r\n`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "X-Goog-Upload-Protocol": "multipart",
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload failed: ${res.status} ${text}`);
  }
}

export async function ingestDirectory(docsDir: string): Promise<IngestResult> {
  const entries = await fs.readdir(docsDir, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".txt"))
    .map((e) => path.join(docsDir, e.name))
    .sort();

  if (files.length === 0) {
    logger.warn("rag.ingest.no_files", { docsDir });
  }

  const corpus = await getOrCreateCorpus();
  const existing = await listRagFiles(corpus.name);
  const existingNames = new Set(existing.map((f) => f.displayName));

  const uploaded: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ file: string; error: string }> = [];

  const total = files.length;
  let index = 0;
  for (const file of files) {
    index += 1;
    const displayName = displayNameForFile(file);

    if (existingNames.has(displayName)) {
      skipped.push(displayName);
      console.log(`Skipped ${index}/${total} (exists): ${displayName}`);
      continue;
    }

    try {
      await uploadRagFile(corpus.name, file, displayName);
      uploaded.push(displayName);
      console.log(`Ingested ${index}/${total} documents: ${displayName}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ file: displayName, error: message });
      console.error(`Failed ${index}/${total}: ${displayName} — ${message}`);
    }
  }

  return { corpus, uploaded, skipped, failed };
}
