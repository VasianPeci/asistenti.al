const DIACRITIC_MAP: Record<string, string> = {
  "ë": "e",
  "Ë": "e",
  "ç": "c",
  "Ç": "c",
};

export function normalizeAlbanian(input: string): string {
  if (!input) return "";
  const replaced = input.replace(/[ëËçÇ]/g, (c) => DIACRITIC_MAP[c] ?? c);
  return replaced
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
