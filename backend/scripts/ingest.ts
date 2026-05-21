import * as path from "node:path";
import { ingestDirectory } from "../src/rag/ingest";
import { logger } from "../src/utils/logger";

async function main(): Promise<void> {
  const docsDir = path.resolve(__dirname, "..", "data", "docs");
  console.log(`Ingesting from: ${docsDir}`);

  const result = await ingestDirectory(docsDir);

  console.log("");
  console.log("==== Ingest summary ====");
  console.log(`Corpus:    ${result.corpus.name}`);
  console.log(`Uploaded:  ${result.uploaded.length}`);
  console.log(`Skipped:   ${result.skipped.length} (already present)`);
  console.log(`Failed:    ${result.failed.length}`);
  if (result.failed.length > 0) {
    for (const f of result.failed) console.log(`  - ${f.file}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  logger.error("ingest.fatal", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
