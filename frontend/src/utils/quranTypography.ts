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

export const DEFAULT_QURAN_TYPOGRAPHY = {
  arabicFontSize: 44,
  translationFontSize: 32,
  typographyVersion: 2,
};

export function normalizeQuranTypography(saved: {
  arabicFontSize?: number; translationFontSize?: number; preferredTranslation?: string; typographyVersion?: number;
}) {
  let arabic = saved.arabicFontSize ?? DEFAULT_QURAN_TYPOGRAPHY.arabicFontSize;
  let translation = saved.translationFontSize ?? DEFAULT_QURAN_TYPOGRAPHY.translationFontSize;
  if (!Number.isFinite(arabic) || !Number.isFinite(translation))
    throw new Error("Quran text sizes must be finite numbers.");
  if (saved.typographyVersion !== DEFAULT_QURAN_TYPOGRAPHY.typographyVersion) {
    if (arabic === 34) arabic = DEFAULT_QURAN_TYPOGRAPHY.arabicFontSize;
    if (saved.translationFontSize !== undefined && (saved.preferredTranslation ?? "kanzul-iman-ur").endsWith("-ur")) {
      // Older Urdu sizes were stored before a hidden 25% optical enlargement.
      translation = translation === 28 ? DEFAULT_QURAN_TYPOGRAPHY.translationFontSize : Math.round(translation * 1.25);
    }
  }
  return {
    arabicFontSize: Math.max(24, Math.min(52, arabic)),
    translationFontSize: Math.max(12, Math.min(48, translation)),
    typographyVersion: DEFAULT_QURAN_TYPOGRAPHY.typographyVersion,
  };
}
