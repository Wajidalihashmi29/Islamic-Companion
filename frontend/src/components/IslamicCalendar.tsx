import { useState } from "react";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Moon, Sparkles } from "lucide-react";
import { loadSettings } from "../utils/settingsStorage";
import { formatHijriDate } from "../utils/hijriDate";
import { getInterfaceLocale } from "../i18n/interfaceTranslations";

const EVENTS = [
  { month: 1, day: 1, name: "Islamic New Year" },
  { month: 3, day: 12, name: "Mawlid / Milad-un-Nabi" },
  { month: 7, day: 27, name: "Mi'raj observance" },
  { month: 8, day: 15, name: "Shab-e-Barat" },
  { month: 9, day: 1, name: "Ramadan begins" },
  { month: 9, day: 27, name: "Laylat al-Qadr observance" },
  { month: 10, day: 1, name: "Eid al-Fitr" },
  { month: 12, day: 10, name: "Eid al-Adha" },
];

function hijriParts(date: Date, offset: number) {
  const adjusted = new Date(date);
  adjusted.setDate(adjusted.getDate() + offset);
  const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
    day: "numeric", month: "numeric", year: "numeric",
  }).formatToParts(adjusted);
  const number = (type: string) => Number(parts.find(part => part.type === type)?.value);
  return { day: number("day"), month: number("month"), year: number("year") };
}

function hijriMonthLabel(date: Date, offset: number, locale: string) {
  const adjusted = new Date(date);
  adjusted.setDate(adjusted.getDate() + offset);
  return new Intl.DateTimeFormat(locale, {
    calendar: "islamic-umalqura",
    month: "long",
    year: "numeric",
  }).format(adjusted);
}

const dateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function IslamicCalendar({ storageKey }: { storageKey: string }) {
  const settings = loadSettings();
  const locale = getInterfaceLocale(settings.general.appLanguage);
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(today);
  const reminderKey = `${storageKey}.calendarReminders`;
  const [reminders, setReminders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(reminderKey) || "[]") as string[]; } catch { return []; }
  });
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const last = new Date(cursor.getFullYear(), cursor.getMonth(), count);
  const firstHijriMonth = hijriMonthLabel(first, settings.general.hijriAdjustment, locale);
  const lastHijriMonth = hijriMonthLabel(last, settings.general.hijriAdjustment, locale);
  const hijriMonthRange = firstHijriMonth === lastHijriMonth
    ? firstHijriMonth
    : `${firstHijriMonth} – ${lastHijriMonth}`;
  const days = Array.from({ length: count }, (_, index) => {
    const date = new Date(first.getFullYear(), first.getMonth(), index + 1);
    const hijri = hijriParts(date, settings.general.hijriAdjustment);
    return { date, hijri, event: EVENTS.find(item => item.month === hijri.month && item.day === hijri.day) };
  });
  const selectedHijri = hijriParts(selected, settings.general.hijriAdjustment);
  const selectedEvent = EVENTS.find(item => item.month === selectedHijri.month && item.day === selectedHijri.day);
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    new Date(2026, 0, 4 + index).toLocaleDateString(locale, { weekday: "short" }));

  const changeMonth = (offset: number) => {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setSelected(next);
  };
  const goToDate = (date: Date) => {
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
    setSelected(date);
  };
  const toggleReminder = async (name: string) => {
    const removing = reminders.includes(name);
    if (!removing && "Notification" in window && Notification.permission === "default")
      await Notification.requestPermission();
    const next = removing ? reminders.filter(item => item !== name) : [...reminders, name];
    setReminders(next);
    localStorage.setItem(reminderKey, JSON.stringify(next));
  };
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  return <section className="faith-panel calendar-experience">
    <div className="faith-intro"><span className="faith-icon"><CalendarDays /></span>
      <div><h2>Islamic Calendar</h2><p>Gregorian and Hijri dates together, with important Islamic occasions clearly marked.</p></div>
    </div>
    <div className="calendar-month-header">
      <button type="button" aria-label="Previous month" onClick={() => changeMonth(-1)}><ChevronLeft /></button>
      <div><span>Gregorian month</span><strong>{cursor.toLocaleDateString(locale, { month: "long", year: "numeric" })}</strong>
        <small><Moon size={14} /> {hijriMonthRange}</small></div>
      <button type="button" aria-label="Next month" onClick={() => changeMonth(1)}><ChevronRight /></button>
    </div>
    <div className="calendar-jump-controls">
      <button type="button" onClick={() => goToDate(new Date())}>Go to today</button>
      <label><span>Go to custom date</span><input type="date" value={dateInputValue(selected)} onChange={event => {
        if (!event.target.value) return;
        const [year, month, day] = event.target.value.split("-").map(Number);
        goToDate(new Date(year, month - 1, day));
      }} /></label>
    </div>
    <div className="calendar-layout">
      <div className="calendar-board">
        <div className="calendar-weekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
        <div className="islamic-calendar-grid">
          {Array.from({ length: first.getDay() }, (_, index) => <span className="calendar-empty" key={`empty-${index}`} />)}
          {days.map(({ date, hijri, event }) => <button type="button" key={date.toISOString()}
            className={`${event ? "has-event " : ""}${sameDay(date, today) ? "is-today " : ""}${sameDay(date, selected) ? "is-selected" : ""}`}
            onClick={() => setSelected(date)}>
            <span className="calendar-gregorian">{date.getDate()}</span>
            <span className="calendar-hijri"><Moon size={11} /> {hijri.day}</span>
            {event && <i aria-label={event.name} />}
          </button>)}
        </div>
        <div className="calendar-legend"><span><i className="today-dot" /> Today</span><span><i className="event-dot" /> Islamic occasion</span></div>
      </div>
      <aside className="calendar-day-panel">
        <span>{selected.toLocaleDateString(locale, { weekday: "long" })}</span>
        <strong>{selected.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}</strong>
        <p><Moon size={17} /> {formatHijriDate(selected, settings.general.hijriAdjustment, settings.general.appLanguage)}</p>
        {selectedEvent ? <div className="calendar-event-card"><Sparkles size={18} /><div><small>Islamic occasion</small><b>{selectedEvent.name}</b></div>
          <button type="button" aria-pressed={reminders.includes(selectedEvent.name)}
            onClick={() => void toggleReminder(selectedEvent.name)}><Bell size={17} fill={reminders.includes(selectedEvent.name) ? "currentColor" : "none"} />
            {reminders.includes(selectedEvent.name) ? "Reminder saved" : "Remind me"}</button></div>
          : <div className="calendar-no-event">No marked occasion on this date.</div>}
        {selectedHijri.month === 9 && <div className="ramadan-guidance"><strong>Ramadan timing</strong>
          <p>Suhoor ends when Fajr begins. Iftar begins at Maghrib. Check Prayer Times for your location.</p></div>}
      </aside>
    </div>
    <p className="faith-note">Hijri dates are calculated estimates and may differ from authoritative local moon sighting.</p>
  </section>;
}
