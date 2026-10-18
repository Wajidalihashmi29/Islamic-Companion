// These source characters are absent from Digital Khatt but present in the bundled fallback.
const indopakFallbackCharacters = /[\u066E\u0674\u06A9\u06AA\u06BE\u06C1\u06CC\u06D2\uE003\uE004\uE01A-\uE01C\uE01E\uE01F\uE021\uE022\uFE8E]|\u06EB/u;

export function normalizeIndoPakText(text: string): string {
  return text.replace(/\u06E1/gu, "\u0652").replace(/\u06E4/gu, "\u0653");
}

export function getQuranTextRuns(text: string, script: "indopak" | "uthmani"): { text: string; fallback: boolean }[] {
  if (script === "uthmani") return [{ text, fallback: false }];
  const normalized = normalizeIndoPakText(text);
  if (!indopakFallbackCharacters.test(normalized)) return [{ text: normalized, fallback: false }];
  return normalized.split(/(\s+)/u).filter(Boolean).map(word => ({
    text: word, fallback: indopakFallbackCharacters.test(word),
  }));
}

export function getQuranTranslationFontSize(size: number, language: string): number {
  const urdu = language === "ur" || language.toLowerCase() === "urdu";
  return urdu ? Math.round(size * 1.25) : size;
}
