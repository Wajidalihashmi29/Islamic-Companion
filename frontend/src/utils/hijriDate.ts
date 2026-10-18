import { CalendarDate, IslamicUmalquraCalendar, toCalendar } from "@internationalized/date";

const calendar = new IslamicUmalquraCalendar();
const months = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah",
];

export function formatHijriDate(date: Date, adjustment = 0): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date for Hijri conversion.");
  if (!Number.isInteger(adjustment)) throw new RangeError("Hijri adjustment must be a whole number of days.");
  // Use the local calendar day, not elapsed milliseconds, so offsets also work across daylight-saving changes.
  const localDate = new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const hijri = toCalendar(localDate.add({ days: adjustment }), calendar);
  return `${hijri.day} ${months[hijri.month - 1]} ${hijri.year} Hijri`;
}
