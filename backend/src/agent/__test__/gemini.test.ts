/* eslint-disable @typescript-eslint/no-explicit-any */
import * as path from "node:path";
import Module from "node:module";

process.env.GOOGLE_CLOUD_PROJECT ??= "test-project";
process.env.GOOGLE_CLOUD_LOCATION ??= "us-central1";

interface MockStreamItem {
  candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
}

const MOCK_TOKENS = ['{"answer":', '"Test reply",', '"steps":[],', '"documents":[],', '"source":null}'];

class MockGenerativeModel {
  constructor(_config: unknown) {}
  startChat(_args: unknown) {
    return {
      async sendMessageStream(_message: string) {
        async function* stream(): AsyncGenerator<MockStreamItem> {
          for (const text of MOCK_TOKENS) {
            yield {
              candidates: [{ content: { parts: [{ text }] } }],
            };
          }
        }
        return { stream: stream() };
      },
    };
  }
}

class MockVertexAI {
  constructor(_args: unknown) {}
  getGenerativeModel(config: unknown): MockGenerativeModel {
    return new MockGenerativeModel(config);
  }
}

// Patch the require cache for @google-cloud/vertexai BEFORE importing gemini.ts.
const resolved = require.resolve("@google-cloud/vertexai");
const fakeModule = new Module(resolved);
fakeModule.filename = resolved;
fakeModule.loaded = true;
(fakeModule as any).exports = { VertexAI: MockVertexAI };
(require.cache as any)[resolved] = fakeModule;

// Now load the module under test — it will receive the mock.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { streamChat } = require(path.resolve(__dirname, "..", "gemini")) as typeof import("../gemini");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parseAgentResponse } = require(path.resolve(__dirname, "..", "parser")) as typeof import("../parser");

async function assert(condition: boolean, message: string): Promise<void> {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

async function main(): Promise<void> {
  const tokens: string[] = [];
  for await (const token of streamChat({
    message: "Si mund të aplikoj për kartë identiteti?",
    history: [],
    contextChunks: [
      {
        text: "Për kartë identiteti aplikohet pranë sportelit të gjendjes civile.",
        source: "karta-identitetit.txt",
        similarity: 0.9,
      },
    ],
  })) {
    process.stdout.write(token);
    tokens.push(token);
  }
  process.stdout.write("\n");

  const full = tokens.join("");
  await assert(tokens.length === MOCK_TOKENS.length, "stream produced all tokens");
  await assert(full.includes("Test reply"), "full text contains expected content");

  const parsed = parseAgentResponse(full);
  await assert(parsed.answer === "Test reply", "parser extracted answer");
  await assert(parsed.steps.length === 0, "parser parsed empty steps");
  await assert(parsed.source === null, "parser parsed null source");

  console.log("\n[ok] streamChat + parser test passed");
}

main().catch((err) => {
  console.error("[fail]", err);
  process.exit(1);
});
