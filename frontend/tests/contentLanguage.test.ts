import assert from "node:assert/strict";
import test from "node:test";
import {
  getContentLocale,
  getHadithEditionPrefix,
  getReligiousContentLanguage,
} from "../src/i18n/contentLanguage.ts";

test("Hindi religious content falls back to Urdu when Hindi is unavailable", () => {
  assert.equal(getReligiousContentLanguage("hi"), "ur");
  assert.equal(getHadithEditionPrefix("hi"), "urd");
  assert.equal(getContentLocale("hi"), "ur");
});

test("interface language selects matching available Hadith content", () => {
  assert.equal(getHadithEditionPrefix("en"), "eng");
  assert.equal(getHadithEditionPrefix("ur"), "urd");
});
