import assert from "node:assert/strict";
import test from "node:test";
import {
  getContentLocale,
  getHadithEditionPrefix,
  getQuranTranslationForInterfaceLanguage,
  getReligiousContentLanguage,
} from "../src/i18n/contentLanguage.ts";

test("Hindi religious content falls back to Urdu when Hindi is unavailable", () => {
  assert.equal(getReligiousContentLanguage("hi"), "ur");
  assert.equal(getHadithEditionPrefix("hi"), "urd");
  assert.equal(getContentLocale("hi"), "ur");
  assert.equal(getQuranTranslationForInterfaceLanguage("hi", "kanzul-iman-en"), "kanzul-iman-ur");
});

test("interface language selects matching available Quran and Hadith content", () => {
  assert.equal(getHadithEditionPrefix("en"), "eng");
  assert.equal(getHadithEditionPrefix("ur"), "urd");
  assert.equal(getQuranTranslationForInterfaceLanguage("en", "kanzul-iman-ur"), "kanzul-iman-en");
  assert.equal(getQuranTranslationForInterfaceLanguage("ur", "kanzul-iman-en"), "kanzul-iman-ur");
  assert.equal(getQuranTranslationForInterfaceLanguage("ur", "irfan-ul-quran-ur"), "irfan-ul-quran-ur");
});
