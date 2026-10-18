import type { QuranPage, QuranSegment } from "../api/quranApi.ts";

const translationBoundaries: Record<string, string> = {
  "kanzul-iman-ur": "نہ ان کا",
  "kanzul-iman-en": "– Not",
  "irfan-ul-quran-ur": "ان لوگوں کا نہیں",
};

// Keep the bundled editions and provider audio in their original numbering.
export function getCanonicalQuranVerse(key: string): string {
  const [surah, ayah] = key.split(":").map(Number);
  return surah === 1 ? `1:${Math.min(7, ayah + 1)}` : key;
}

export function getReaderQuranVerse(key: string): string | null {
  if (key === "1:1") return null;
  const [surah, ayah] = key.split(":").map(Number);
  return surah === 1 ? `1:${ayah - 1}` : key;
}

function splitArabic(text: string): [string, string] {
  const words = text.trim().split(/\s+/u);
  const boundary = words.findIndex(word =>
    word.normalize("NFD").replace(/[\p{M}\u200B\u200E\u200F]/gu, "") === "غير");
  if (boundary <= 0) throw new Error("The Al-Fatihah text could not be divided into seven Ayahs.");
  return [words.slice(0, boundary).join(" "), words.slice(boundary).join(" ")];
}

export function formatFatihahPage(page: QuranPage, edition: string): QuranPage {
  if (page.pageNumber !== 1) return page;
  const verses = new Map<number, QuranSegment>();
  for (const segment of page.lines.flatMap(line => line.segments)) {
    if (segment.surahNumber !== 1) throw new Error("Unexpected Surah on the Al-Fatihah page.");
    const previous = verses.get(segment.verseNumberInSurah);
    verses.set(segment.verseNumberInSurah, previous ? {
      ...segment,
      textIndoPak: `${previous.textIndoPak} ${segment.textIndoPak}`.trim(),
      textUthmani: `${previous.textUthmani} ${segment.textUthmani}`.trim(),
      translation: `${previous.translation} ${segment.translation}`.trim(),
    } : segment);
  }
  const final = verses.get(7);
  if (verses.size !== 7 || !final) throw new Error("The Al-Fatihah source is incomplete.");
  const indoPak = splitArabic(final.textIndoPak), uthmani = splitArabic(final.textUthmani);
  const boundary = translationBoundaries[edition];
  const index = boundary ? final.translation.indexOf(boundary) : -1;
  if (index <= 0) throw new Error("The selected Al-Fatihah translation could not be divided into seven Ayahs.");
  const translations = [final.translation.slice(0, index).trim(), final.translation.slice(index).trim()];
  const segments = Array.from({ length: 7 }, (_, index) => {
    const number = index + 1;
    const original = verses.get(number < 6 ? number + 1 : 7)!;
    return {
      ...original, verseKey: `1:${number}`, verseNumberInSurah: number,
      ...(number >= 6 ? {
        textIndoPak: indoPak[number - 6], textUthmani: uthmani[number - 6],
        translation: translations[number - 6], isRukuEnd: number === 7 && original.isRukuEnd,
      } : {}),
    };
  });
  return {
    ...page,
    lines: segments.map((segment, index) => ({
      lineNumber: index + 1, textIndoPak: segment.textIndoPak, translation: segment.translation,
      surahHeaderBeforeLine: index === 0 ? page.lines.find(line => line.surahHeaderBeforeLine)?.surahHeaderBeforeLine ?? null : null,
      isJuzStart: index === 0 && page.lines.some(line => line.isJuzStart), segments: [segment],
    })),
  };
}
