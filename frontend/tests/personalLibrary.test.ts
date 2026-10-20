import assert from "node:assert/strict";
import test from "node:test";
import {
  deletePersonalData,
  loadQuranPageNote,
  loadSavedHadiths,
  saveQuranPageNote,
  toggleSavedHadith,
} from "../src/utils/personalLibrary.ts";

function installBrowserStorage() {
  const values = new Map<string, string>();
  Object.assign(globalThis, {
    localStorage: {
      get length() { return values.size; },
      getItem(key: string) { return values.get(key) ?? null; },
      setItem(key: string, value: string) { values.set(key, value); },
      removeItem(key: string) { values.delete(key); },
      key(index: number) { return [...values.keys()][index] ?? null; },
    },
    window: { dispatchEvent() { return true; } },
  });
  return values;
}

test("personal-library records remain isolated by profile", () => {
  installBrowserStorage();
  toggleSavedHadith("ic.settings.user-one", {
    bookName: "Test collection",
    hadithNumber: 1,
    arabic: "Arabic",
    translation: "Translation",
    sourceUrl: "https://example.com/hadith",
  });
  saveQuranPageNote("ic.settings.user-one", 12, "Remember this page");

  assert.equal(loadSavedHadiths("ic.settings.user-one").length, 1);
  assert.equal(loadSavedHadiths("ic.settings.user-two").length, 0);
  assert.equal(loadQuranPageNote("ic.settings.user-one", 12), "Remember this page");
  assert.equal(loadQuranPageNote("ic.settings.user-two", 12), "");
});

test("deleting one profile leaves another profile untouched", () => {
  const values = installBrowserStorage();
  saveQuranPageNote("ic.settings.user-one", 1, "First");
  saveQuranPageNote("ic.settings.user-two", 2, "Second");
  values.set("ic.settings.user-one", "{}");
  values.set("ic.settings.user-two", "{}");
  values.set("ic.settings.user-one.azkarFavorites", "[\"sayyid-istighfar\"]");
  values.set("ic.settings.user-one.calendarReminders", "[\"Eid al-Fitr\"]");

  deletePersonalData("ic.settings.user-one");

  assert.equal(loadQuranPageNote("ic.settings.user-one", 1), "");
  assert.equal(loadQuranPageNote("ic.settings.user-two", 2), "Second");
  assert.equal(values.has("ic.settings.user-one"), false);
  assert.equal(values.has("ic.settings.user-one.azkarFavorites"), false);
  assert.equal(values.has("ic.settings.user-one.calendarReminders"), false);
  assert.equal(values.has("ic.settings.user-two"), true);
});

test("malformed stored library data falls back safely", () => {
  const values = installBrowserStorage();
  values.set("ic.settings.user-one.hadithBookmarks", "{bad json");
  assert.deepEqual(loadSavedHadiths("ic.settings.user-one"), []);
});
