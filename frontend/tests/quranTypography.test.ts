import assert from "node:assert/strict";
import test from "node:test";
import { getQuranLineHeightMultiplier, getQuranTextRuns, normalizeQuranTypography } from "../src/utils/quranTypography.ts";

test("Indo-Pak maddah and sukun use supported marks without stripping vowels or changing Uthmani", () => {
  const source = "لَا\u06E4 اِلٰهَ ال\u06E1قَيُّو\u06E1مُ";
  assert.deepEqual(getQuranTextRuns(source, "indopak"), [
    { text: "لَا\u0653 اِلٰهَ ال\u0652قَيُّو\u0652مُ", fallback: false },
  ]);
  assert.deepEqual(getQuranTextRuns(source, "uthmani"), [{ text: source, fallback: false }]);
});

test("unsupported Indo-Pak letters and internal pause signs use whole-word fallback without losing spaces or marks", () => {
  const source = "ذٰلِكَ  ال\u06AAِتٰبُ اُولٰٓ\u066Eِٕكَ\tقُلُوْبِهِمْ\uE021ۚ";
  const runs = getQuranTextRuns(source, "indopak");
  assert.equal(runs.map(run => run.text).join(""), source);
  assert.deepEqual(runs.filter(run => run.fallback).map(run => run.text),
    ["ال\u06AAِتٰبُ", "اُولٰٓ\u066Eِٕكَ", "قُلُوْبِهِمْ\uE021ۚ"]);
  assert.equal(runs[0].fallback, false);
  assert.deepEqual(getQuranTextRuns(source, "uthmani"), [{ text: source, fallback: false }]);
});

test("previous defaults migrate to 60px Arabic and 36px translation without enlarging them again on reload", () => {
  const migrated = normalizeQuranTypography({ arabicFontSize: 34, translationFontSize: 28 });
  assert.deepEqual(migrated, { arabicFontSize: 60, translationFontSize: 36, typographyVersion: 9 });
  assert.deepEqual(normalizeQuranTypography(migrated), migrated);
  assert.deepEqual(normalizeQuranTypography({}), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 44, translationFontSize: 32, typographyVersion: 2 }), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 48, translationFontSize: 32, typographyVersion: 3 }), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 52, translationFontSize: 32, typographyVersion: 4 }), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 52, translationFontSize: 36, typographyVersion: 5 }), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 54, translationFontSize: 36, typographyVersion: 6 }), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 56, translationFontSize: 36, typographyVersion: 7 }), migrated);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 58, translationFontSize: 36, typographyVersion: 8 }), migrated);
});

test("custom text sizes survive migration and small user-selected sizes are retained on subsequent loads", () => {
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 52, translationFontSize: 20, preferredTranslation: "irfan-ul-quran-ur" }),
    { arabicFontSize: 52, translationFontSize: 25, typographyVersion: 9 });
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 32, translationFontSize: 18, preferredTranslation: "kanzul-iman-en" }),
    { arabicFontSize: 32, translationFontSize: 18, typographyVersion: 9 });
  const custom = { arabicFontSize: 34, translationFontSize: 12, typographyVersion: 9 };
  assert.deepEqual(normalizeQuranTypography(custom), custom);
  assert.deepEqual(normalizeQuranTypography({ arabicFontSize: 100, translationFontSize: 100, typographyVersion: 9 }),
    { arabicFontSize: 64, translationFontSize: 56, typographyVersion: 9 });
  assert.throws(() => normalizeQuranTypography({ translationFontSize: NaN }), /finite/);
});

test("fit-page line spacing is tighter so Arabic letters remain larger on small screens", () => {
  assert.equal(getQuranLineHeightMultiplier("indopak", false), 1.85);
  assert.equal(getQuranLineHeightMultiplier("indopak", true), 1.55);
  assert.equal(getQuranLineHeightMultiplier("uthmani", false), 2.65);
  assert.equal(getQuranLineHeightMultiplier("uthmani", true), 2.2);
});
