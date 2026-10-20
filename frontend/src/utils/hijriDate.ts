import { CalendarDate, IslamicUmalquraCalendar, toCalendar } from "@internationalized/date";

const calendar = new IslamicUmalquraCalendar();
const months = [
  "Muharram-ul-Haram",
  "Safar-ul-Muzaffar",
  "Rabi-ul-Awwal",
  "Rabi-ul-Akhir",
  "Jumada-ul-Ula",
  "Jumada-ul-Ukhra",
  "Rajab-ul-Murajjab",
  "Sha'ban-ul-Mu'azzam",
  "Ramadan-ul-Mubarak",
  "Shawwal-ul-Mukarram",
  "Zul-Qa'dah",
  "Zul-Hijjah",
];

const urduMonths = [
  "محرم الحرام",
  "صفر المظفر",
  "ربیع الاول",
  "ربیع الآخر",
  "جمادی الاولیٰ",
  "جمادی الاخریٰ",
  "رجب المرجب",
  "شعبان المعظم",
  "رمضان المبارک",
  "شوال المکرم",
  "ذوالقعدۃ",
  "ذوالحجۃ",
];

const hindiMonths = [
  "मुहर्रम-उल-हराम",
  "सफ़र-उल-मुज़फ़्फ़र",
  "रबी-उल-अव्वल",
  "रबी-उल-आख़िर",
  "जुमादा-उल-ऊला",
  "जुमादा-उल-उख़रा",
  "रजब-उल-मुरज्जब",
  "शाबान-उल-मोअज़्ज़म",
  "रमज़ान-उल-मुबारक",
  "शव्वाल-उल-मुकर्रम",
  "ज़ुल-क़ादा",
  "ज़ुल-हिज्जा",
];

export function getHijriParts(date: Date, adjustment = 0): { day: number; month: number; year: number } {
  if (!Number.isFinite(date.getTime())) throw new RangeError("Invalid date for Hijri conversion.");
  const safeAdjustment = Number.isInteger(adjustment) ? adjustment : Math.round(adjustment) || 0;
  // Use the local calendar day, not elapsed milliseconds, so offsets also work across daylight-saving changes.
  const localDate = new CalendarDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const hijri = toCalendar(localDate.add({ days: safeAdjustment }), calendar);
  return { day: hijri.day, month: hijri.month, year: hijri.year };
}

export function getHijriMonthName(monthNumber: number, language = "en"): string {
  const index = Math.max(0, Math.min(11, monthNumber - 1));
  if (language === "ur") return urduMonths[index];
  if (language === "hi") return hindiMonths[index];
  return months[index];
}

export function formatHijriMonthRange(
  firstDate: Date,
  lastDate: Date,
  adjustment = 0,
  language = "en"
): string {
  const first = getHijriParts(firstDate, adjustment);
  const last = getHijriParts(lastDate, adjustment);
  const firstMonth = getHijriMonthName(first.month, language);
  const lastMonth = getHijriMonthName(last.month, language);
  const suffix = language === "ur" ? "ہجری" : language === "hi" ? "हिजरी" : "Hijri";

  if (first.month === last.month && first.year === last.year) {
    return `${firstMonth} ${first.year} ${suffix}`;
  }
  if (first.year === last.year) {
    return `${firstMonth} – ${lastMonth} ${first.year} ${suffix}`;
  }
  return `${firstMonth} ${first.year} – ${lastMonth} ${last.year} ${suffix}`;
}

export function formatHijriDate(date: Date, adjustment = 0, language = "en"): string {
  const { day, month, year } = getHijriParts(date, adjustment);
  const localizedMonths = language === "ur" ? urduMonths : language === "hi" ? hindiMonths : months;
  const suffix = language === "ur" ? "ہجری" : language === "hi" ? "हिजरी" : "Hijri";
  return `${day} ${localizedMonths[month - 1]} ${year} ${suffix}`;
}
