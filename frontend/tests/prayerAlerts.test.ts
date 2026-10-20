import assert from "node:assert/strict";
import test from "node:test";
import { PRAYER_ALERT_NAMES, normalizePrayerAlertNames } from "../src/utils/prayerAlerts.ts";

test("new and legacy settings default to alerts for all five prayers", () => {
  assert.deepEqual(normalizePrayerAlertNames(undefined), PRAYER_ALERT_NAMES);
  assert.deepEqual(normalizePrayerAlertNames("Fajr"), PRAYER_ALERT_NAMES);
});

test("saved prayer alert selections retain only supported prayers in standard order", () => {
  assert.deepEqual(
    normalizePrayerAlertNames(["Isha", "Unknown", "Fajr", "Fajr"]),
    ["Fajr", "Isha"],
  );
  assert.deepEqual(normalizePrayerAlertNames([]), []);
});
