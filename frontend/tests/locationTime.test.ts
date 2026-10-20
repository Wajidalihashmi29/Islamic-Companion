import assert from "node:assert/strict";
import test from "node:test";
import { distanceBetweenCoordinates, getDateInTimeZone } from "../src/utils/locationTime.ts";

test("location time uses the selected location's calendar date and clock", () => {
  const instant = new Date("2026-10-20T10:00:00Z");
  const kolkata = getDateInTimeZone(instant, "Asia/Kolkata");
  const newYork = getDateInTimeZone(instant, "America/New_York");

  assert.deepEqual(
    [kolkata.getFullYear(), kolkata.getMonth(), kolkata.getDate(), kolkata.getHours(), kolkata.getMinutes()],
    [2026, 9, 20, 15, 30],
  );
  assert.deepEqual(
    [newYork.getFullYear(), newYork.getMonth(), newYork.getDate(), newYork.getHours(), newYork.getMinutes()],
    [2026, 9, 20, 6, 0],
  );
});

test("invalid or absent timezones safely retain the supplied date", () => {
  const instant = new Date("2026-10-20T10:00:00Z");
  assert.equal(getDateInTimeZone(instant), instant);
  assert.equal(getDateInTimeZone(instant, "Not/A_Timezone"), instant);
});

test("coordinate distance distinguishes small GPS drift from meaningful movement", () => {
  const origin = { latitude: 19.076, longitude: 72.8777 };
  const nearby = { latitude: 19.0765, longitude: 72.878 };
  const moved = { latitude: 19.2183, longitude: 72.9781 };

  assert.ok(distanceBetweenCoordinates(origin, nearby) < 1_000);
  assert.ok(distanceBetweenCoordinates(origin, moved) > 1_000);
});
