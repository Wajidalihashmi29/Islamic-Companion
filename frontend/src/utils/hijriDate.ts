import { CalendarDate, IslamicUmalquraCalendar, toCalendar } from "@internationalized/date";

const calendar = new IslamicUmalquraCalendar();
const months = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah",
];
const urduMonths = [
  "محرم", "صفر", "ربیع الاول", "ربیع الثانی",
  "جمادی الاول", "جمادی الثانی", "رجب", "شعبان",
  "رمضان", "شوال", "ذوالقعدہ", "ذوالحجہ",
];
const hindiMonths = [
  "मुहर्रम", "सफ़र", "रबीउल अव्वल", "रबीउल आखिर",
  "जमादिल अव्वल", "जमादिल आखिर", "रजब", "शाबान",
  "रमज़ान", "शव्वाल", "ज़िलक़ादा", "ज़िलहिज्जा",
];

export function formatHijriDate(date: Date, adjustment = 0, language = "en"): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date for Hijri conversion.");
  if (!Number.isInteger(adjustment)) throw new RangeError("Hijri adjustment must be a whole number of days.");
  // Use the local calendar day, not elapsed milliseconds, so offsets also work across daylight-saving changes.
  const localDate = new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const hijri = toCalendar(localDate.add({ days: adjustment }), calendar);
  const localizedMonths = language === "ur" ? urduMonths : language === "hi" ? hindiMonths : months;
  const suffix = language === "ur" ? "ہجری" : language === "hi" ? "हिजरी" : "Hijri";
  return `${hijri.day} ${localizedMonths[hijri.month - 1]} ${hijri.year} ${suffix}`;
}
