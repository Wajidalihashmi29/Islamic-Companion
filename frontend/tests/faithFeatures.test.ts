import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQiblaBearing,
  calculateRelativeBearing,
  calculateZakat,
  getCompassDirection,
  getHanafiNisabBasis,
  getSmallestAngleDifference,
  normalizeDegrees,
  smoothCompassHeading,
  unwrapDegrees,
} from "../src/utils/faithFeatures.ts";

test("Qibla bearing points toward Makkah from known cities", () => {
  assert(Math.abs(calculateQiblaBearing(51.5074, -0.1278) - 118.99) < .5);
  assert(Math.abs(calculateQiblaBearing(40.7128, -74.006) - 58.48) < .5);
  assert.equal(getCompassDirection(118.99), "SE");
  assert.equal(getCompassDirection(359), "N");
});

test("live compass rotation stays stable across north", () => {
  assert.equal(normalizeDegrees(-10), 350);
  assert.equal(calculateRelativeBearing(60, 350), 70);
  assert.equal(getSmallestAngleDifference(358, 2), 4);
  assert.equal(unwrapDegrees(358, 2), 362);
  assert.equal(unwrapDegrees(2, 358), -2);
  assert.equal(smoothCompassHeading(null, 358), 358);
  assert(Math.abs(smoothCompassHeading(358, 2) - 359.2) < .001);
  assert(Math.abs(smoothCompassHeading(10, 100) - 86.5) < .001);
});

test("Zakat is due only when net assets reach the selected nisab", () => {
  const due = calculateZakat(10_000, 2_000, 5_000, true);
  assert.equal(due.netAssets, 8_000);
  assert.equal(due.nisabReached, true);
  assert.equal(due.eligible, true);
  assert.equal(due.due, 200);

  const belowNisab = calculateZakat(4_000, 500, 5_000, true);
  assert.equal(belowNisab.netAssets, 3_500);
  assert.equal(belowNisab.nisabReached, false);
  assert.equal(belowNisab.eligible, false);
  assert.equal(belowNisab.due, 0);
});

test("Hanafi nisab is gold only for exclusively gold wealth and silver otherwise", () => {
  assert.equal(getHanafiNisabBasis(10_000, 0, 0), "gold");
  assert.equal(getHanafiNisabBasis(0, 10_000, 0), "silver");
  assert.equal(getHanafiNisabBasis(0, 0, 10_000), "silver");
  assert.equal(getHanafiNisabBasis(10_000, 1, 0), "silver");
  assert.equal(getHanafiNisabBasis(10_000, 0, 1), "silver");
  assert.equal(getHanafiNisabBasis(0, 0, 0), "silver");
});

test("Zakat waits for the lunar anniversary and never deducts more debt than the assets", () => {
  const awaitingHawl = calculateZakat(10_000, 2_000, 5_000, false);
  assert.equal(awaitingHawl.nisabReached, true);
  assert.equal(awaitingHawl.eligible, false);
  assert.equal(awaitingHawl.due, 0);

  const noNegativeWealth = calculateZakat(3_000, 8_000, 1_000, true);
  assert.equal(noNegativeWealth.deductibleDebts, 3_000);
  assert.equal(noNegativeWealth.netAssets, 0);
  assert.equal(noNegativeWealth.due, 0);
});
