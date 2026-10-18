import type { QuranLine, QuranSegment } from "../api/quranApi";
import { normalizeIndoPakText } from "./quranTypography.ts";

export type QuranReadingSegment = Omit<QuranSegment, "textIndoPak" | "textUthmani"> & {
  text: string;
  ayahStopSigns: string;
};
export type QuranReadingLine = Omit<QuranLine, "segments"> & {
  segments: QuranReadingSegment[];
  isSectionEnd: boolean;
};

const words = (text: string) => text.trim().split(/\s+/u).filter(Boolean);
const digits = (number: number) => String(number).replace(/\d/g, digit => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)]);
const endingSigns = /[\s\u200B\u200E\u200F]*((?:[\u0615\u06D6-\u06DC\u06EA-\u06EC\uE01A-\uE01C\uE01E\uE01F\uE021\uE022][\s\u200B\u200E\u200F]*)+)$/u;

export function layoutQuranLines(source: QuranLine[], script: "indopak" | "uthmani",
  width: number, measure: (text: string) => number, sealWidth: number): QuranReadingLine[] {
  if (width <= 0) return [];
  const sajdahVerses = new Set(source.flatMap(line =>
    line.segments.filter(segment => segment.isSajdah).map(segment => segment.verseKey)));
  const totals = new Map<string, { arabic: number; translation: string[]; used: number }>();
  const previousChunks = new Map<string, { segment: QuranSegment; tokens: string[]; signs: string }>();
  const prepared = source.map(line => ({
    ...line,
    chunks: line.segments.map((segment, index) => {
      const sourceText = script === "indopak" ? normalizeIndoPakText(segment.textIndoPak) : segment.textUthmani;
      const verseText = sajdahVerses.has(segment.verseKey)
        ? sourceText.replace(/[\u200B\u200E\u200F]*\u06E9[\u200B\u200E\u200F]*/gu, "") : sourceText;
      // Render the Para symbol from boundary metadata, not the provider's Madani divisions.
      const original = line.isJuzStart && index === 0 ? verseText.replace(/^(?:\s*\u06DE)+\s*/u, "") : verseText;
      const match = segment.endsAyah ? endingSigns.exec(original) : null;
      const text = match ? original.slice(0, match.index) : original;
      const tokens = words(text);
      const total = totals.get(segment.verseKey) ?? { arabic: 0, translation: [], used: 0 };
      total.arabic += tokens.length;
      total.translation.push(...words(segment.translation));
      totals.set(segment.verseKey, total);
      const chunk = { segment, tokens, signs: match ? match[1].replace(/[\s\u200B\u200E\u200F]/gu, "") : "" };
      const previous = previousChunks.get(segment.verseKey);
      // A source row can contain only the Sajdah symbol; keep its end metadata on the preceding words.
      if (!tokens.length && previous && segment.endsAyah) {
        previous.segment = segment;
        previous.signs = chunk.signs;
      } else if (tokens.length) previousChunks.set(segment.verseKey, chunk);
      return chunk;
    }),
  }));
  const result: QuranReadingLine[] = [];
  let row: QuranReadingSegment[] = [];
  let header: QuranLine["surahHeaderBeforeLine"] = null;
  let juzStart = false;
  let text = "";
  let markersWidth = 0;
  function flush(sectionEnd = false) {
    if (!row.length) {
      if (sectionEnd && result.length) result[result.length - 1].isSectionEnd = true;
      return;
    }
    const translations = row.map(segment => {
      const total = totals.get(segment.verseKey)!;
      const start = Math.floor(total.used * total.translation.length / total.arabic);
      total.used += words(segment.text).length;
      const end = Math.floor(total.used * total.translation.length / total.arabic);
      segment.translation = total.translation.slice(start, end).join(" ");
      return segment.translation + (segment.endsAyah ? ` ﴿${digits(segment.verseNumberInSurah)}﴾` : "");
    });
    result.push({
      lineNumber: result.length + 1, textIndoPak: text, translation: translations.join(" ").trim(),
      surahHeaderBeforeLine: header, isJuzStart: juzStart, segments: row, isSectionEnd: sectionEnd,
    });
    row = []; text = ""; markersWidth = 0; header = null; juzStart = false;
  }
  for (const line of prepared) {
    if (line.surahHeaderBeforeLine || line.isJuzStart) flush(true);
    header = line.surahHeaderBeforeLine ?? header;
    juzStart ||= line.isJuzStart;
    if (line.isJuzStart) markersWidth += measure("\u06DE\u202F");
    for (const { segment, tokens, signs } of line.chunks) {
      const isSajdah = sajdahVerses.has(segment.verseKey);
      let index = 0;
      while (index < tokens.length) {
        const remaining = tokens.length - index;
        const fits = (count: number) => {
          const words = tokens.slice(index, index + count).join(" ");
          const candidate = text ? `${text} ${words}` : words;
          const extra = count === remaining && segment.endsAyah ? sealWidth + (isSajdah ? sealWidth : 0) : 0;
          return measure(candidate) + markersWidth + extra <= width;
        };
        let count = remaining;
        if (!fits(count)) {
          let low = 0, high = remaining - 1;
          while (low < high) {
            const middle = Math.ceil((low + high) / 2);
            if (fits(middle)) low = middle;
            else high = middle - 1;
          }
          count = low;
        }
        if (!count && row.length) { flush(); continue; }
        // An indivisible word must still render even if it is wider than the row.
        count = Math.max(1, count);
        const words = tokens.slice(index, index + count).join(" ");
        index += count;
        const endsAyah = index === tokens.length && segment.endsAyah;
        const extra = endsAyah ? sealWidth + (isSajdah ? sealWidth : 0) : 0;
        text = text ? `${text} ${words}` : words;
        markersWidth += extra;
        const previous = row[row.length - 1];
        if (previous?.verseKey === segment.verseKey && !previous.endsAyah) {
          previous.text += ` ${words}`;
          previous.endsAyah = endsAyah;
          previous.isRukuEnd = endsAyah && segment.isRukuEnd;
          previous.ayahStopSigns = endsAyah ? signs : "";
        } else {
          row.push({
            ...segment, text: words, endsAyah, isSajdah,
            isRukuEnd: endsAyah && segment.isRukuEnd, ayahStopSigns: endsAyah ? signs : "",
          });
        }
        if (index < tokens.length) flush();
      }
    }
  }
  flush(true);
  return result;
}
