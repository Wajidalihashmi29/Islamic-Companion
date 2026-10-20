import assert from "node:assert/strict";
import test from "node:test";
import { clearOfflineQuran, getQuranOfflineUrls } from "../src/utils/quranOffline.ts";

test("offline Quran download includes the directory and all 604 pages", () => {
  const urls = getQuranOfflineUrls("https://example.com/api", "https://app.example.com", "kanzul-iman-ur", 16);
  assert.equal(urls.length, 605);
  assert.equal(urls[0], "https://example.com/api/quran/directory");
  assert.equal(urls[1], "https://example.com/api/quran/page/1?translation=kanzul-iman-ur&lines=16");
  assert.equal(urls.at(-1), "https://example.com/api/quran/page/604?translation=kanzul-iman-ur&lines=16");
});

test("relative API bases resolve against the application origin", () => {
  const urls = getQuranOfflineUrls("/api", "https://app.example.com", "kanzul-iman-en", 15);
  assert.equal(urls[0], "https://app.example.com/api/quran/directory");
  assert.equal(urls[1], "https://app.example.com/api/quran/page/1?translation=kanzul-iman-en&lines=15");
});

test("missing API configuration uses the same-origin API route", () => {
  const urls = getQuranOfflineUrls(undefined, "https://app.example.com", "kanzul-iman-ur", 16);
  assert.equal(urls[0], "https://app.example.com/api/quran/directory");
});

test("clearing offline Quran removes its cache and completion markers only", async () => {
  const values = new Map([
    ["ic.quranOffline.1.kanzul-iman-ur.16", "complete"],
    ["ic.settings.guest", "{}"],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index: number) { return [...values.keys()][index] ?? null; },
    removeItem(key: string) { values.delete(key); },
  };
  let deletedCache = "";
  Object.assign(globalThis, {
    window: { caches: {} },
    localStorage: storage,
    caches: { delete: async (name: string) => { deletedCache = name; return true; } },
  });

  await clearOfflineQuran();

  assert.equal(deletedCache, "islamic-companion-quran-v1");
  assert.equal(values.has("ic.quranOffline.1.kanzul-iman-ur.16"), false);
  assert.equal(values.has("ic.settings.guest"), true);
});
