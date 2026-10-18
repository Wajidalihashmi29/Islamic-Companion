import assert from "node:assert/strict";
import test from "node:test";
import { getQuranTextRuns, getQuranTranslationFontSize } from "../src/utils/quranTypography.ts";

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

test("Urdu is optically enlarged consistently for API and Settings languages while other sizes stay unchanged", () => {
  for (const language of ["ur", "urdu", "Urdu"]) {
    assert.equal(getQuranTranslationFontSize(28, language), 35);
    assert.equal(getQuranTranslationFontSize(20, language), 25);
    assert.equal(getQuranTranslationFontSize(12, language), 15);
  }
  for (const language of ["en", "English", "hi"]) {
    assert.equal(getQuranTranslationFontSize(28, language), 28);
    assert.equal(getQuranTranslationFontSize(20, language), 20);
  }
});
