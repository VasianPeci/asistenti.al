import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RetrievedChunk } from "./retriever";
import { logger } from "../utils/logger";

const DOCS_DIR = join(process.cwd(), "data", "docs");

const SERVICE_DOCS: Array<{ source: string; keywords: string[] }> = [
  {
    source: "pasaporta.txt",
    keywords: ["passport", "pasaport"],
  },
  {
    source: "certifikate_lindje.txt",
    keywords: ["birth certificate", "certifikat lindj", "certifikate lindj", "certifikaten e lindjes", "akti i lindjes"],
  },
  {
    source: "vdekje.txt",
    keywords: ["death certificate", "certifikat vdekj", "certifikate vdekj", "certifikaten e vdekjes", "akti i vdekjes", "vdekje"],
  },
  {
    source: "deshmi_penaliteti.txt",
    keywords: ["criminal record", "deshmi penalitet", "penalitet"],
  },
  {
    source: "biznes_nipt.txt",
    keywords: ["business", "biznes", "nipt", "tax id"],
  },
  {
    source: "patente.txt",
    keywords: ["driver", "license", "licence", "patent", "leje drejtimi", "lejen e drejtimit"],
  },
  {
    source: "regjistrim_automjeti.txt",
    keywords: ["vehicle", "car registration", "register a car", "automjet", "mjet"],
  },
  {
    source: "karte_identiteti.txt",
    keywords: ["identity card", "id card", "karte identitet", "karta identitet"],
  },
  {
    source: "leje_qendrimi.txt",
    keywords: ["residence permit", "leje qendrimi", "qendrim"],
  },
  {
    source: "martese.txt",
    keywords: [
      "marriage",
      "martese",
      "martes",
      "regjistrim martese",
      "dokumente per martese",
      "dokumentesh nevojiten per martese",
    ],
  },
];

function normalize(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/(.)\1{2,}/g, "$1$1")
    .replace(/[!?.,"'()[\]{}:;]+/g, "")
    .replace(/\s+/g, " ");
}

function readDoc(source: string): string | null {
  try {
    return readFileSync(join(DOCS_DIR, source), "utf8");
  } catch (err) {
    logger.warn("rag.local_doc.read_failed", {
      source,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export function retrievePinnedServiceChunks(query: string): RetrievedChunk[] {
  const normalized = normalize(query);
  const matches = SERVICE_DOCS.filter((doc) =>
    doc.keywords.some((keyword) => normalized.includes(keyword))
  );

  const chunks = matches.flatMap<RetrievedChunk>((match) => {
    const text = readDoc(match.source);
    if (!text) return [];
    return [{ text, source: match.source, similarity: 0 }];
  });

  if (chunks.length > 0) {
    logger.info("rag.local_doc.pinned", {
      query: normalized.slice(0, 60),
      sources: chunks.map((chunk) => chunk.source),
    });
  }

  return chunks;
}

export function mergeRetrievedChunks(
  pinnedChunks: RetrievedChunk[],
  ragChunks: RetrievedChunk[]
): RetrievedChunk[] {
  const seen = new Set<string>();
  const merged: RetrievedChunk[] = [];

  for (const chunk of [...pinnedChunks, ...ragChunks]) {
    const key = chunk.source.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(chunk);
  }

  return merged;
}
