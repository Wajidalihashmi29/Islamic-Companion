const KAABA = { latitude: 21.422487, longitude: 39.826206 };

const toRadians = (degrees: number) => degrees * Math.PI / 180;
const toDegrees = (radians: number) => radians * 180 / Math.PI;

export function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export function calculateRelativeBearing(targetBearing: number, deviceHeading: number): number {
  return normalizeDegrees(targetBearing - deviceHeading);
}

export function getSmallestAngleDifference(first: number, second: number): number {
  return Math.abs(((normalizeDegrees(first) - normalizeDegrees(second) + 540) % 360) - 180);
}

export function unwrapDegrees(previous: number, next: number): number {
  const difference = ((normalizeDegrees(next) - normalizeDegrees(previous) + 540) % 360) - 180;
  return previous + difference;
}

export function smoothCompassHeading(previous: number | null, next: number): number {
  if (previous === null) return normalizeDegrees(next);
  const unwrapped = unwrapDegrees(previous, next);
  const movement = Math.abs(unwrapped - previous);
  const response = movement >= 45 ? .85 : movement >= 15 ? .6 : .3;
  return previous + (unwrapped - previous) * response;
}

export function calculateQiblaBearing(latitude: number, longitude: number): number {
  const lat = toRadians(latitude);
  const kaabaLat = toRadians(KAABA.latitude);
  const longitudeDifference = toRadians(KAABA.longitude - longitude);
  const bearing = toDegrees(Math.atan2(
    Math.sin(longitudeDifference) * Math.cos(kaabaLat),
    Math.cos(lat) * Math.sin(kaabaLat) -
      Math.sin(lat) * Math.cos(kaabaLat) * Math.cos(longitudeDifference),
  ));
  return normalizeDegrees(bearing);
}

export function getCompassDirection(bearing: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(normalizeDegrees(bearing) / 45) % directions.length];
}

export function getHanafiNisabBasis(gold: number, silver: number, otherAssets: number): "gold" | "silver" {
  const hasGold = gold > 0;
  const hasSilverOrOtherAssets = silver > 0 || otherAssets > 0;
  return hasGold && !hasSilverOrOtherAssets ? "gold" : "silver";
}

export function calculateZakat(
  totalAssets: number,
  debtsDue: number,
  nisab: number,
  lunarYearComplete: boolean,
) {
  const assets = Math.max(0, totalAssets);
  const deductibleDebts = Math.min(assets, Math.max(0, debtsDue));
  const netAssets = assets - deductibleDebts;
  const nisabReached = nisab > 0 && netAssets >= nisab;
  const eligible = nisabReached && lunarYearComplete;
  return {
    totalAssets: assets,
    deductibleDebts,
    netAssets,
    nisabReached,
    lunarYearComplete,
    eligible,
    due: eligible ? netAssets / 40 : 0,
  };
}
