import assert from "node:assert/strict";
import test from "node:test";
import { formatHijriDate } from "../src/utils/hijriDate.ts";

test("Umm al-Qura dates match known Ramadan and Hijri new-year dates and use the Hijri label", () => {
  for (const [year, month, day, expected] of [
    [2024, 3, 11, "1 Ramadan 1445 Hijri"],
    [2025, 3, 1, "1 Ramadan 1446 Hijri"],
    [2026, 2, 18, "1 Ramadan 1447 Hijri"],
    [2026, 6, 16, "1 Muharram 1448 Hijri"],
    [2026, 10, 18, "7 Jumada al-Awwal 1448 Hijri"],
  ] as const) {
    assert.equal(formatHijriDate(new Date(year, month - 1, day, 12)), expected);
  }
});

test("moon-sighting adjustments cross Hijri month and year boundaries correctly", () => {
  const firstRamadan = new Date(2025, 2, 1, 12);
  for (const [offset, expected] of [
    [-2, "28 Sha'ban 1446 Hijri"], [-1, "29 Sha'ban 1446 Hijri"],
    [0, "1 Ramadan 1446 Hijri"], [1, "2 Ramadan 1446 Hijri"], [2, "3 Ramadan 1446 Hijri"],
  ] as const) assert.equal(formatHijriDate(firstRamadan, offset), expected);
  assert.equal(formatHijriDate(new Date(2026, 5, 16, 12), -1), "29 Dhu al-Hijjah 1447 Hijri");
});

test("conversion still works when the browser cannot format an Islamic calendar", context => {
  context.mock.method(Intl, "DateTimeFormat", () => { throw new RangeError("Unsupported calendar"); });
  assert.equal(formatHijriDate(new Date(2026, 9, 18, 12)), "7 Jumada al-Awwal 1448 Hijri");
});

test("conversion uses the device's local day and adds calendar days across daylight-saving changes", context => {
  const original = process.env.TZ;
  context.after(() => {
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
  });
  const instant = new Date("2026-10-17T20:00:00Z");
  process.env.TZ = "Asia/Kolkata";
  assert.equal(formatHijriDate(instant), "7 Jumada al-Awwal 1448 Hijri");
  process.env.TZ = "America/Los_Angeles";
  assert.equal(formatHijriDate(instant), "6 Jumada al-Awwal 1448 Hijri");
  process.env.TZ = "America/New_York";
  assert.equal(formatHijriDate(new Date(2026, 10, 1, 0, 30), 1), formatHijriDate(new Date(2026, 10, 2, 12)));
});

test("invalid dates and fractional adjustments produce explicit errors rather than misleading dates", () => {
  assert.throws(() => formatHijriDate(new Date(NaN)), RangeError);
  assert.throws(() => formatHijriDate(new Date(2026, 9, 18), 0.5), RangeError);
});
