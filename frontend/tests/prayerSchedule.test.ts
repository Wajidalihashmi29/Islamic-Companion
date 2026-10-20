import assert from "node:assert/strict";
import test from "node:test";
import { getPrayerSchedule, hasPrayerStarted } from "../src/utils/prayerSchedule.ts";

const timings = {
  Fajr: "05:00",
  Sunrise: "06:20",
  Dhuhr: "12:10",
  Asr: "16:30",
  Maghrib: "18:15",
  Isha: "19:40",
};

const at = (hours: number, minutes: number) => {
  const date = new Date(2026, 9, 20, hours, minutes, 0);
  return getPrayerSchedule(timings, date);
};

test("Fajr ends at sunrise instead of continuing until Dhuhr", () => {
  assert.equal(at(6, 19)?.current, "Fajr");
  assert.equal(at(6, 20)?.current, null);
  assert.equal(at(8, 0)?.current, null);
  assert.equal(at(8, 0)?.next, "Dhuhr");
});

test("each prayer ends at its recognized boundary", () => {
  assert.equal(at(12, 10)?.current, "Dhuhr");
  assert.equal(at(16, 30)?.current, "Asr");
  assert.equal(at(18, 15)?.current, "Maghrib");
  assert.equal(at(19, 40)?.current, "Isha");
  assert.equal(at(4, 59)?.current, "Isha");
  assert.equal(at(5, 0)?.current, "Fajr");
});

test("prayers cannot be completed before their start time", () => {
  const beforeDhuhr = new Date(2026, 9, 20, 12, 9, 59);
  const atDhuhr = new Date(2026, 9, 20, 12, 10, 0);
  assert.equal(hasPrayerStarted(timings, "Dhuhr", beforeDhuhr), false);
  assert.equal(hasPrayerStarted(timings, "Dhuhr", atDhuhr), true);
  assert.equal(hasPrayerStarted(undefined, "Dhuhr", atDhuhr), false);
});
