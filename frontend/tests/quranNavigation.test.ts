import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { loadQuranReaderView, loadQuranReadingPage, normalizeQuranSearch, parseAyahReference,
  saveQuranReaderView, saveQuranReadingPage } from "../src/utils/quranNavigation.ts";

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
let values: Map<string, string>;
beforeEach(() => {
  values = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  } });
});
afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else Reflect.deleteProperty(globalThis, "localStorage");
});

test("Ayah lookup accepts Latin, Arabic and Urdu digits and canonicalizes references", () => {
  assert.equal(parseAyahReference("33:56"), "33:56");
  for (const query of ["33:22", "٣٣:٢٢", "۳۳:۲۲", " 033 : 022 ", "３３：２２"])
    assert.equal(parseAyahReference(query), "33:22");
  for (const query of ["-33:56", "33:-22", "3 3:22", "33:56:1", "33:", "33", "name", "3.3:22"])
    assert.equal(parseAyahReference(query), null);
  assert.equal(normalizeQuranSearch("وَمَا لِيَ"), normalizeQuranSearch("وما لي"));
});

test("Reading progress survives a reload and remains isolated between accounts and guests", () => {
  const guest = "ic.appSettings_guest", first = "ic.appSettings_user_first", second = "ic.appSettings_user_second";
  assert.equal(loadQuranReadingPage(guest), null);
  saveQuranReadingPage(guest, 442);
  saveQuranReadingPage(first, 421);
  saveQuranReadingPage(second, 604);
  assert.equal(loadQuranReadingPage(guest), 442);
  assert.equal(loadQuranReadingPage(first), 421);
  assert.equal(loadQuranReadingPage(second), 604);
  saveQuranReadingPage(first, 1);
  assert.equal(loadQuranReadingPage(guest), 442);
  assert.equal(loadQuranReadingPage(second), 604);
});

test("Corrupt saved progress and out-of-range pages are rejected rather than resumed", () => {
  const profile = "ic.appSettings_guest";
  for (const raw of ["bad-json", "null", "0", "605", "1.5", "\"42\"", "{\"page\":42}"]) {
    values.set(`${profile}:quran-page`, raw);
    assert.throws(() => loadQuranReadingPage(profile));
  }
  for (const page of [0, 605, 1.5, NaN, Infinity])
    assert.throws(() => saveQuranReadingPage(profile, page));
});

test("Unavailable browser storage is surfaced to the reader", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: () => { throw new Error("Storage blocked"); },
    setItem: () => { throw new Error("Storage blocked"); },
  } });
  assert.throws(() => loadQuranReadingPage("guest"), /Storage blocked/);
  assert.throws(() => saveQuranReadingPage("guest", 42), /Storage blocked/);
  assert.throws(() => loadQuranReaderView("guest"), /Storage blocked/);
  assert.throws(() => saveQuranReaderView("guest", { mode: "scroll", position: null }), /Storage blocked/);
});

test("whole-page mode is browser-local and isolated by profile", () => {
  assert.deepEqual(loadQuranReaderView("guest"), { mode: "scroll", position: null });
  const view = { mode: "fit" as const, position: null };
  saveQuranReaderView("guest", view);
  saveQuranReaderView("account", { mode: "scroll", position: null });
  assert.deepEqual(loadQuranReaderView("guest"), view);
  assert.deepEqual(loadQuranReaderView("account"), { mode: "scroll", position: null });
});

test("previous screen-by-screen readers migrate to whole-page mode without changing their saved Quran page", () => {
  saveQuranReadingPage("guest", 442);
  values.set("guest:quran-view", JSON.stringify({ mode: "screens", position: { page: 442, verseKey: "36:22", wordOffset: 8 } }));
  assert.deepEqual(loadQuranReaderView("guest"), { mode: "fit", position: null });
  assert.equal(loadQuranReadingPage("guest"), 442);
  values.set("guest:quran-view", JSON.stringify({ mode: "screens", position: null }));
  assert.deepEqual(loadQuranReaderView("guest"), { mode: "fit", position: null });
});

test("mobile readers default and migrate to fit without overriding an explicit new scrolling preference", () => {
  assert.deepEqual(loadQuranReaderView("guest", "fit"), { mode: "fit", position: null });
  values.set("guest:quran-view", JSON.stringify({ mode: "scroll", position: null }));
  assert.deepEqual(loadQuranReaderView("guest", "fit"), { mode: "fit", position: null });
  assert.deepEqual(loadQuranReaderView("guest"), { mode: "scroll", position: null });
  saveQuranReaderView("guest", { mode: "scroll", position: null });
  assert.deepEqual(loadQuranReaderView("guest", "fit"), { mode: "scroll", position: null });
  saveQuranReadingPage("guest", 3);
  assert.equal(loadQuranReadingPage("guest"), 3);
});

test("invalid saved screen positions are reported rather than silently used", () => {
  for (const raw of ["null", "{}", "{\"mode\":\"bad\",\"position\":null}",
    ...[{ page: 605, verseKey: "36:22", wordOffset: 0 }, { page: 442, verseKey: "0:22", wordOffset: 0 },
      { page: 442, verseKey: "36:22", wordOffset: -1 }, { page: 442, verseKey: "36:0", wordOffset: 0 }]
      .map(position => JSON.stringify({ mode: "screens", position }))]) {
    values.set("guest:quran-view", raw);
    assert.throws(() => loadQuranReaderView("guest"));
  }
});
