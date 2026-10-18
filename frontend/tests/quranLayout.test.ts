import assert from "node:assert/strict";
import test from "node:test";
import { layoutQuranLines } from "../src/utils/quranLayout.ts";
import type { QuranLine, QuranSegment, QuranSurah } from "../src/api/quranApi.ts";

const segment = (key: string, text: string, translation: string, update: Partial<QuranSegment> = {}): QuranSegment => ({
  verseKey: key, verseNumberInSurah: Number(key.split(":")[1]), surahNumber: Number(key.split(":")[0]),
  textIndoPak: text, textUthmani: text, translation, endsAyah: true, isSajdah: false,
  isRukuEnd: false, rukuNumberInSurah: 1, rukuNumberOverall: 1, rukuNumberInJuz: 1, rukuAyahCount: 1, ...update,
});
const line = (segments: QuranSegment[], update: Partial<QuranLine> = {}): QuranLine => ({
  lineNumber: 1, textIndoPak: "", translation: "", surahHeaderBeforeLine: null, isJuzStart: false,
  segments, ...update,
});
const measure = (text: string) => text.length;
const layout = (lines: QuranLine[], width = 100) => layoutQuranLines(lines, "indopak", width, measure, 3);

test("Ayahs flow across source rows rather than one Ayah per display row", () => {
  const result = layout([line([segment("2:1", "الم", "ایک")]), line([segment("2:2", "ذٰلِكَ الْكِتَابُ", "دو تین")])]);
  assert.equal(result.length, 1);
  assert.equal(result[0].segments.length, 2);
  assert.equal(result[0].translation, "ایک ﴿۱﴾ دو تین ﴿۲﴾");
});

test("wrapped rows preserve every Arabic and selected translation word exactly once", () => {
  const arabic = "ا ب ج د ہ و ز ح ط ی ک ل";
  const translation = "یہ مکمل منتخب ترجمہ اسی ترتیب میں ہر سطر کے نیچے آتا ہے";
  const result = layout([line([segment("2:7", arabic, translation, {
    isRukuEnd: true, rukuNumberInJuz: 2, rukuAyahCount: 7,
  })])], 9);
  assert(result.length > 1);
  assert.equal(result.flatMap(row => row.segments.map(s => s.text)).join(" "), arabic);
  assert.equal(result.map(row => row.translation).join(" ").replace(/\s*﴿۷﴾/u, "").trim(), translation);
  assert(result.every(row => row.translation.length > 0));
  assert.equal(result.flatMap(row => row.segments).filter(s => s.endsAyah).length, 1);
  assert.equal(result.at(-1)?.segments.at(-1)?.isRukuEnd, true);
  assert.equal(result.at(-1)?.segments.at(-1)?.rukuNumberInJuz, 2);
  assert.equal(result.at(-1)?.segments.at(-1)?.rukuAyahCount, 7);
});

test("section metadata stays with the first row and sections end centered", () => {
  const header: QuranSurah = { number: 2, name: "Baqara", nameArabic: "البقرة",
    ayahCount: 286, rukuCount: 40, startPage: 2, revelationPlace: "madinah" };
  const result = layout([line([segment("1:7", "ا ب", "ایک")]),
    line([segment("2:1", "ج د ہ و ز ح", "دو تین چار پانچ")], { surahHeaderBeforeLine: header, isJuzStart: true })], 8);
  assert.equal(result[0].isSectionEnd, true);
  assert.equal(result[1].surahHeaderBeforeLine, header);
  assert.equal(result[1].isJuzStart, true);
  assert.equal(result.filter(row => row.surahHeaderBeforeLine).length, 1);
  assert.equal(result.at(-1)?.isSectionEnd, true);
});

test("verse-final stop signs move to seals while internal pauses and diacritics stay unchanged", () => {
  const source = [line([segment("2:7", "قَلْبٌ\u06D8 اَجْرٌ\u06E1 \uE022\u200F", "ترجمہ")])];
  const snapshot = JSON.stringify(source);
  const result = layout(source, 9);
  const chunks = result.flatMap(row => row.segments);
  assert.equal(chunks.map(s => s.text).join(" "), "قَلْبٌ\u06D8 اَجْرٌ\u0652");
  assert.equal(chunks.at(-1)?.ayahStopSigns, "\uE022");
  assert(chunks.slice(0, -1).every(s => !s.ayahStopSigns));
  assert.equal(JSON.stringify(source), snapshot);
});

test("non-final pause marks are not extracted and Uthmani reflows independently", () => {
  const source = [line([segment("2:3", "ا\u06D8", "ایک", { endsAyah: false, textUthmani: "ا ب ج د" }),
    segment("2:3", "ب\u06E2", "دو")])];
  const indopak = layout(source);
  assert.equal(indopak[0].segments[0].text, "ا\u06D8 ب\u06E2");
  assert.equal(indopak[0].segments[0].ayahStopSigns, "");
  const uthmani = layoutQuranLines(source, "uthmani", 5, measure, 3);
  assert(uthmani.length > indopak.length);
});

test("Indo-Pak uses the font's sukun glyph without removing marks or changing source or Uthmani text", () => {
  const arabic = "ال\u06E1كَو\u06E1ثَرَ\u0615";
  const source = [line([segment("108:1", arabic, "ترجمہ")])];
  const snapshot = JSON.stringify(source);
  const indopak = layout(source)[0].segments[0];
  assert.equal(indopak.text, "ال\u0652كَو\u0652ثَرَ");
  assert.equal(indopak.ayahStopSigns, "\u0615");
  const uthmani = layoutQuranLines(source, "uthmani", 100, measure, 3)[0].segments[0];
  assert.equal(uthmani.text, "ال\u06E1كَو\u06E1ثَرَ");
  assert.equal(JSON.stringify(source), snapshot);
});

test("Para starts reserve space for one symbol without counting it as an Arabic or translation word", () => {
  for (const script of ["indopak", "uthmani"] as const) {
    for (const prefix of ["", "۞ "]) {
      const source = [line([segment("36:22", `${prefix}الف باء جيم`, "ایک دو تین")], { isJuzStart: true })];
      const snapshot = JSON.stringify(source);
      const result = layoutQuranLines(source, script, 14, measure, 3);
      assert.equal(result.length, 2);
      assert.equal(result[0].isJuzStart, true);
      assert.equal(result[1].isJuzStart, false);
      assert.equal(result[0].segments[0].text, "الف باء");
      assert.equal(result[0].translation, "ایک دو");
      assert.equal(result[1].translation, "تین ﴿۲۲﴾");
      assert.equal(result.flatMap(row => row.segments).map(item => item.text).join(" "), "الف باء جيم");
      assert.equal(JSON.stringify(source), snapshot);
    }
  }
});

test("provider Hizb symbols outside Para openings remain unchanged", () => {
  const result = layout([line([segment("36:28", "۞ الف باء", "ایک دو")])]);
  assert.equal(result[0].segments[0].text, "۞ الف باء");
  assert(result.every(row => !row.isJuzStart));
});

test("Indo-Pak maddah is normalized before line measurement without altering source data", () => {
  const text = "اللّٰهُ لَا\u06E4 اِلٰهَ اِلَّا هُوَ";
  const source = [line([segment("3:2", text, "ترجمہ")])], snapshot = JSON.stringify(source);
  const measured: string[] = [];
  const result = layoutQuranLines(source, "indopak", 100, value => {
    measured.push(value); return value.length;
  }, 3);
  assert.equal(result[0].segments[0].text, text.replace("\u06E4", "\u0653"));
  assert(measured.every(value => !value.includes("\u06E4")));
  assert.equal(JSON.stringify(source), snapshot);
  assert.equal(layoutQuranLines(source, "uthmani", 100, measure, 3)[0].segments[0].text, text);
});

test("Sajdah marks every wrapped fragment with one end symbol, retaining marker-only source row metadata", () => {
  for (const script of ["indopak", "uthmani"] as const) {
    for (const separate of [false, true]) {
      const parts = separate ? [
        line([segment("17:109", "الف باء جيم", "ایک دو", { endsAyah: false })]),
        line([segment("17:109", "\u06DA \u06E9\u200F", "تین", { isSajdah: true, isRukuEnd: true })]),
      ] : [line([segment("17:109", "الف باء جيم \u06DA \u06E9\u200F", "ایک دو تین", { isSajdah: true, isRukuEnd: true })])];
      const snapshot = JSON.stringify(parts);
      const result = layoutQuranLines(parts, script, 10, measure, 3);
      const chunks = result.flatMap(row => row.segments);
      assert.equal(chunks.map(chunk => chunk.text).join(" "), "الف باء جيم");
      assert(chunks.length > 1);
      assert(chunks.every(chunk => chunk.isSajdah));
      assert.equal(chunks.filter(chunk => chunk.endsAyah && chunk.isSajdah).length, 1);
      assert.equal(chunks.at(-1)?.endsAyah, true);
      assert.equal(chunks.at(-1)?.isRukuEnd, true);
      assert.equal(chunks.at(-1)?.ayahStopSigns, "\u06DA");
      assert.equal(result.map(row => row.translation).join(" ").replace(/\s*﴿۱۰۹﴾/u, "").trim(), "ایک دو تین");
      assert.equal(JSON.stringify(parts), snapshot);
    }
  }
});

test("Sajdah marking starts with the Ayah's first source fragment and does not extend to neighboring Ayahs", () => {
  const source = [
    line([segment("17:108", "سابق", "پہلے"), segment("17:109", "الف باء", "ایک دو", { endsAyah: false })]),
    line([segment("17:109", "جيم دال", "تین چار", { isSajdah: true }), segment("17:110", "لاحق", "بعد")]),
  ];
  for (const script of ["indopak", "uthmani"] as const) {
    const chunks = layoutQuranLines(source, script, 12, measure, 3).flatMap(row => row.segments);
    const sajdah = chunks.filter(chunk => chunk.verseKey === "17:109");
    assert(sajdah.length > 1);
    assert(sajdah.every(chunk => chunk.isSajdah));
    assert.equal(sajdah.map(chunk => chunk.text).join(" "), "الف باء جيم دال");
    assert.equal(sajdah.filter(chunk => chunk.endsAyah).length, 1);
    assert(chunks.filter(chunk => chunk.verseKey !== "17:109").every(chunk => !chunk.isSajdah));
  }
});

test("Sajdah source symbols without a metadata replacement are not removed and distinct pause signs are retained", () => {
  const result = layout([line([segment("17:109", "الف \u06E9", "ایک")]),
    line([segment("3:1", "الٓمّٓ\u2002\u06DA\u06D9\u200F", "دو")])]);
  const chunks = result.flatMap(row => row.segments);
  assert.equal(chunks[0].text, "الف \u06E9");
  assert.equal(chunks[0].isSajdah, false);
  assert.equal(chunks.at(-1)?.ayahStopSigns, "\u06DA\u06D9");
});
