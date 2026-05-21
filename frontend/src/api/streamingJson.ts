const ANSWER_PATTERN = /"answer"\s*:\s*"((?:[^"\\]|\\.)*)/;

const ESCAPE_MAP: Record<string, string> = {
  '"': '"',
  "\\": "\\",
  "/": "/",
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  f: "\f",
};

function unescapeJsonString(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "\\" && i + 1 < raw.length) {
      const next = raw[i + 1]!;
      const mapped = ESCAPE_MAP[next];
      if (mapped !== undefined) {
        out += mapped;
        i += 1;
        continue;
      }
      if (next === "u" && i + 5 < raw.length) {
        const hex = raw.slice(i + 2, i + 6);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16));
          i += 5;
          continue;
        }
      }
    }
    out += ch;
  }
  return out;
}

export function extractStreamingAnswer(buffer: string): string {
  if (!buffer) return "";
  const match = ANSWER_PATTERN.exec(buffer);
  if (!match || match[1] === undefined) return "";
  return unescapeJsonString(match[1]).trim();
}

export function shouldShowSkeleton(buffer: string): boolean {
  return extractStreamingAnswer(buffer) === "";
}

if (import.meta.env.DEV) {
  const tests: Array<[string, string]> = [
    ['{"answer": "Hello', "Hello"],
    ['{"answer": "Hello world"', "Hello world"],
    ['{"answer": "She said \\"hi\\"', 'She said "hi"'],
    ['{"answer": "Line 1\\nLine 2', "Line 1\nLine 2"],
    ["{", ""],
    ["", ""],
  ];
  for (const [input, expected] of tests) {
    const actual = extractStreamingAnswer(input);
    if (actual !== expected) {
      console.error("[streamingJson] test failed", { input, expected, actual });
    }
  }
}
