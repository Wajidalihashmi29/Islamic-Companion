import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReciter, RECITERS_OPTIONS } from "../src/utils/quranReciters.ts";
import { getOfflineQuranPreferencePatch } from "../src/utils/offlineQuranPreferences.ts";

test("reciters keep the requested order and exclude Al-Minshawi", () => {
  assert.deepEqual(
    RECITERS_OPTIONS.map(option => option.id),
    ["shuraim", "sudais", "abdul-basit", "alafasy", "husary"],
  );
});

test("removed or unknown reciters migrate to the default", () => {
  assert.equal(normalizeReciter("minshawi"), "shuraim");
  assert.equal(normalizeReciter("unknown"), "shuraim");
  assert.equal(normalizeReciter("sudais"), "sudais");
});

test("logout keeps completed offline Quran preferences without copying the account profile", () => {
  const patch = getOfflineQuranPreferencePatch({
    general: { appLanguage: "ur" },
    quran: { preferredTranslation: "irfan-ul-quran-ur", mushafLines: 16 },
  });

  assert.deepEqual(patch, {
    general: { appLanguage: "ur" },
    quran: { preferredTranslation: "irfan-ul-quran-ur", mushafLines: 16 },
  });
});
