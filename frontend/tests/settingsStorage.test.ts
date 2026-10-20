import assert from "node:assert/strict";
import test from "node:test";
import { normalizeReciter, RECITERS_OPTIONS } from "../src/utils/quranReciters.ts";

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
