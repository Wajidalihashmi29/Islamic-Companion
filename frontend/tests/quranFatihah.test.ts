import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import type { QuranPage, QuranSegment } from "../src/api/quranApi.ts";
import { formatFatihahPage, getCanonicalQuranVerse, getReaderQuranVerse } from "../src/utils/quranFatihah.ts";
import { layoutQuranLines } from "../src/utils/quranLayout.ts";
import { getAdjacentQuranVerse } from "../src/utils/quranAudio.ts";

const data = resolve(import.meta.dirname, "..", "..", "backend", "IslamicCompanion.Infrastructure", "Data", "Quran");
const indoPak: { verses: { text_indopak: string }[] } = JSON.parse(readFileSync(resolve(data, "indopak.json"), "utf8"));
const uthmani = [...readFileSync(resolve(data, "uthmani.xml"), "utf8")
  .matchAll(/<aya index="\d+" text="([^"]*)"/gu)].slice(0, 7).map(match => match[1]);
const editions = {
  "kanzul-iman-ur": "ur.kanzuliman.txt",
  "kanzul-iman-en": "en.ahmedraza.txt",
  "irfan-ul-quran-ur": "ur.qadri.txt",
};

function sourcePage(file: string): QuranPage {
  const translations = readFileSync(resolve(data, file), "utf8").split("\n").slice(0, 7)
    .map(line => line.trimEnd().split("|")[2]);
  const segments: QuranSegment[] = translations.map((translation, index) => ({
    verseKey: `1:${index + 1}`, verseNumberInSurah: index + 1, surahNumber: 1,
    textIndoPak: indoPak.verses[index].text_indopak, textUthmani: uthmani[index],
    translation, endsAyah: true, isRukuEnd: index === 6, isSajdah: false,
    rukuNumberInSurah: 1, rukuNumberOverall: 1, rukuNumberInJuz: 1, rukuAyahCount: 7,
  }));
  return {
    pageNumber: 1, juzNumber: 1, juzNameArabic: "", manzilNumber: 1,
    translationLanguage: file.startsWith("ur") ? "ur" : "en", bismillahTranslation: translations[0],
    lines: segments.map((segment, index) => ({
      lineNumber: index + 1, textIndoPak: segment.textIndoPak, translation: segment.translation,
      isJuzStart: index === 0, segments: [segment],
      surahHeaderBeforeLine: index === 0 ? {
        number: 1, name: "Al Fatihah", nameArabic: "الفاتحة", ayahCount: 7,
        rukuCount: 1, startPage: 1, revelationPlace: "makkah",
      } : null,
    })),
  };
}

for (const [edition, file] of Object.entries(editions)) {
  test(`seven Fatihah Ayahs preserve Arabic and ${edition} without counting Bismillah`, () => {
    const source = sourcePage(file);
    const before = JSON.stringify(source);
    // Exercise provider line splitting, including a wrapped final canonical Ayah.
    source.lines = source.lines.flatMap(line => {
      const segment = line.segments[0];
      const split = (text: string) => [text.split(" ").slice(0, 1).join(" "), text.split(" ").slice(1).join(" ")];
      const arabic = split(segment.textIndoPak), uthmani = split(segment.textUthmani), translation = split(segment.translation);
      return [0, 1].map(index => ({
        ...line, surahHeaderBeforeLine: index === 0 ? line.surahHeaderBeforeLine : null,
        isJuzStart: index === 0 && line.isJuzStart,
        segments: [{ ...segment, textIndoPak: arabic[index], textUthmani: uthmani[index],
          translation: translation[index], endsAyah: index === 1, isRukuEnd: index === 1 && segment.isRukuEnd }],
      }));
    });
    const unchanged = JSON.stringify(source);
    const result = formatFatihahPage(source, edition);
    assert.equal(JSON.stringify(source), unchanged);
    const original: QuranPage = JSON.parse(before);
    const segments = result.lines.flatMap(line => line.segments);
    assert.deepEqual(segments.map(segment => segment.verseKey), Array.from({ length: 7 }, (_, index) => `1:${index + 1}`));
    assert.equal(segments[0].textIndoPak, indoPak.verses[1].text_indopak);
    for (const field of ["textIndoPak", "textUthmani", "translation"] as const) {
      assert.equal(segments.map(segment => segment[field]).join(" "),
        original.lines.slice(1).flatMap(line => line.segments).map(segment => segment[field]).join(" "));
    }
    assert.equal(result.bismillahTranslation, original.bismillahTranslation);
    assert.equal(result.lines.filter(line => line.surahHeaderBeforeLine).length, 1);
    assert.equal(result.lines.filter(line => line.isJuzStart).length, 1);
    assert.deepEqual(segments.filter(segment => segment.isRukuEnd).map(segment => segment.verseKey), ["1:7"]);
    for (const script of ["indopak", "uthmani"] as const) {
      const layout = layoutQuranLines(result.lines, script, 80, text => text.length, 3);
      assert.deepEqual(layout.flatMap(line => line.segments).filter(segment => segment.endsAyah)
        .map(segment => segment.verseNumberInSurah), [1, 2, 3, 4, 5, 6, 7]);
    }
  });
}

test("reader references map search, grouped Tafseer and recitation without playing the final passage twice", () => {
  assert.deepEqual(Array.from({ length: 7 }, (_, index) => getCanonicalQuranVerse(`1:${index + 1}`)),
    ["1:2", "1:3", "1:4", "1:5", "1:6", "1:7", "1:7"]);
  assert.equal(getReaderQuranVerse("1:1"), null);
  assert.equal(getReaderQuranVerse("1:2"), "1:1");
  assert.equal(getReaderQuranVerse("1:7"), "1:6");
  assert.equal(getCanonicalQuranVerse("2:1"), "2:1");
  const surahs = [{ ayahCount: 7 }, { ayahCount: 286 }];
  let key: string | null = getCanonicalQuranVerse("1:1");
  const played: string[] = [];
  while (key?.startsWith("1:")) {
    played.push(key);
    key = getAdjacentQuranVerse(key, 1, surahs);
  }
  assert.deepEqual(played, ["1:2", "1:3", "1:4", "1:5", "1:6", "1:7"]);
  assert.equal(key, "2:1");
});

test("other pages are unchanged and incomplete or unsupported Fatihah text fails explicitly", () => {
  const page = sourcePage(editions["kanzul-iman-ur"]);
  const other = { ...page, pageNumber: 2 };
  assert.equal(formatFatihahPage(other, "kanzul-iman-ur"), other);
  assert.throws(() => formatFatihahPage({ ...page, lines: page.lines.slice(1) }, "kanzul-iman-ur"), /incomplete/);
  assert.throws(() => formatFatihahPage(page, "unknown"), /translation/);
});
