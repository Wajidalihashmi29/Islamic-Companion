import assert from "node:assert/strict";
import test from "node:test";
import {
  getInterfaceLocale,
  normalizeInterfaceLanguage,
  translateInterfaceText,
} from "../src/i18n/interfaceTranslations.ts";

test("normalizes supported interface languages", () => {
  assert.equal(normalizeInterfaceLanguage("ur"), "ur");
  assert.equal(normalizeInterfaceLanguage("hi"), "hi");
  assert.equal(normalizeInterfaceLanguage("fr"), "en");
  assert.equal(getInterfaceLocale("ur"), "ur-PK");
  assert.equal(getInterfaceLocale("hi"), "hi-IN");
});

test("translates static and dynamic interface text", () => {
  assert.equal(translateInterfaceText("Prayer Times", "ur"), "نماز کے اوقات");
  assert.equal(translateInterfaceText("Prayer Times", "hi"), "नमाज़ के समय");
  assert.equal(translateInterfaceText("Page 42 of 604", "ur"), "صفحہ ۴۲ از ۶۰۴");
  assert.equal(
    translateInterfaceText("Keep the selected translation below the Arabic", "ur"),
    "منتخب ترجمہ عربی متن کے نیچے دکھائیں",
  );
  assert.equal(translateInterfaceText("Tafseer · Urdu", "ur"), "تفسیر · اردو");
  assert.equal(
    translateInterfaceText("Sirat-ul-Jinan — Mufti Muhammad Qasim Attari", "ur"),
    "صراط الجنان — مفتی محمد قاسم عطاری",
  );
  assert.equal(translateInterfaceText("60px", "ur"), "۶۰ پکسل");
  assert.equal(translateInterfaceText("۶۰ پکسل", "en"), "60px");
  assert.equal(
    translateInterfaceText("Kanzul Iman — Ala Hazrat Imam Ahmad Raza Khan (May Allah have mercy on him)", "ur"),
    "کنز الایمان — اعلیٰ حضرت امام احمد رضا خان رحمۃ اللہ علیہ",
  );
  assert.equal(translateInterfaceText("Sheikh Abdur-Rahman As-Sudais", "ur"), "شیخ عبدالرحمٰن السدیس");
  assert.equal(
    translateInterfaceText("Fixed whole page · Under each line", "ur"),
    "مقررہ مکمل صفحہ · ہر سطر کے نیچے",
  );
  assert.equal(
    translateInterfaceText("Favourite reading · General page 42 saved", "hi"),
    "पसंदीदा पठन · सामान्य पृष्ठ ४२ सहेजा गया",
  );
  assert.equal(translateInterfaceText("Assalamu Alaikum, Wajid", "hi"), "अस्सलामु अलैकुम, Wajid");
  assert.equal(translateInterfaceText("6:30 AM", "ur"), "۶:۳۰ صبح");
  assert.equal(translateInterfaceText("Standard (0)", "hi"), "मानक (०)");
});

test("can switch a translated value back to another language", () => {
  const urdu = translateInterfaceText("Settings", "ur");
  assert.equal(translateInterfaceText(urdu, "hi"), "सेटिंग्स");
  assert.equal(translateInterfaceText(urdu, "en"), "Settings");
  assert.equal(translateInterfaceText("صفحہ ۴۲ از ۶۰۴", "en"), "Page 42 of 604");
  assert.equal(translateInterfaceText("۲ دن", "en"), "2 Day");
  assert.equal(translateInterfaceText("۶:۳۰ شام", "hi"), "६:३० अपराह्न");
});
