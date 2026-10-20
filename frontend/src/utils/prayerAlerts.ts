export const PRAYER_ALERT_NAMES = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

export type PrayerAlertName = (typeof PRAYER_ALERT_NAMES)[number];

export function normalizePrayerAlertNames(value: unknown): PrayerAlertName[] {
  if (!Array.isArray(value)) return [...PRAYER_ALERT_NAMES];
  return PRAYER_ALERT_NAMES.filter(name => value.includes(name));
}
