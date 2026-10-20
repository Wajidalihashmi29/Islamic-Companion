export const MAIN_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
export const DISPLAY_TIMINGS = ["Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

const DAY_SECONDS = 24 * 60 * 60;

export function prayerTimeToSeconds(value?: string): number {
  if (!value) return Number.NaN;
  const [hours, minutes] = value.split(" ")[0].split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return (hours * 60 + minutes) * 60;
}

export function hasPrayerStarted(
  timings: Record<string, string> | undefined,
  prayer: (typeof MAIN_PRAYERS)[number],
  now: Date,
): boolean {
  const start = prayerTimeToSeconds(timings?.[prayer]);
  if (!Number.isFinite(start)) return false;
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return nowSec >= start;
}

export interface PrayerScheduleState {
  current: string | null;
  next: string;
  nowSec: number;
  remaining: number;
  progress: number;
  periodStart: number;
  periodEnd: number;
}

export function getPrayerSchedule(
  timings: Record<string, string> | undefined,
  now: Date,
): PrayerScheduleState | null {
  if (!timings) return null;

  const seconds = Object.fromEntries(
    DISPLAY_TIMINGS.map(name => [name, prayerTimeToSeconds(timings[name])]),
  ) as Record<(typeof DISPLAY_TIMINGS)[number], number>;
  if (MAIN_PRAYERS.some(name => Number.isNaN(seconds[name])) || Number.isNaN(seconds.Sunrise)) {
    return null;
  }

  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const periods = [
    { current: "Isha", start: seconds.Isha - DAY_SECONDS, end: seconds.Fajr },
    { current: "Fajr", start: seconds.Fajr, end: seconds.Sunrise },
    { current: null, start: seconds.Sunrise, end: seconds.Dhuhr },
    { current: "Dhuhr", start: seconds.Dhuhr, end: seconds.Asr },
    { current: "Asr", start: seconds.Asr, end: seconds.Maghrib },
    { current: "Maghrib", start: seconds.Maghrib, end: seconds.Isha },
    { current: "Isha", start: seconds.Isha, end: seconds.Fajr + DAY_SECONDS },
  ];
  const period = periods.find(item => nowSec >= item.start && nowSec < item.end) ?? periods[0];
  const next = MAIN_PRAYERS.find(name => seconds[name] > nowSec) ?? "Fajr";
  const nextSec = seconds[next] + (next === "Fajr" && seconds.Fajr <= nowSec ? DAY_SECONDS : 0);
  const span = Math.max(1, period.end - period.start);

  return {
    current: period.current,
    next,
    nowSec,
    remaining: Math.max(0, nextSec - nowSec),
    progress: Math.min(1, Math.max(0, (nowSec - period.start) / span)),
    periodStart: period.start,
    periodEnd: period.end,
  };
}
