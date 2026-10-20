import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bell, CalendarDays, Check, ChevronLeft, ChevronRight, CloudSun, MapPin, Moon, Sparkles, Star, Sun, Sunrise, Sunset, Volume2, X } from "lucide-react";
import LocationSelector from "./LocationSelector";
import type { ResolvedLocation } from "./LocationSelector";
import {
  getPrayerTimetableByCity,
  getPrayerTimetableByCoords,
  getPrayerTimesByCity,
  getPrayerTimesByCoords,
} from "../api/prayerTimesApi";
import type { PrayerTimesResponse } from "../api/prayerTimesApi";
import { loadSettings, saveSettings } from "../utils/settingsStorage";
import { formatHijriDate } from "../utils/hijriDate";
import { getContentLocale } from "../i18n/contentLanguage";
import { getInterfaceLocale } from "../i18n/interfaceTranslations";
import GoldenSpiral from "./GoldenSpiral";
import { getFriendlyErrorMessage } from "../utils/friendlyError";
import { normalizeRegion, saveRegion } from "../utils/regionalFormatting";
import { DISPLAY_TIMINGS, getPrayerSchedule, prayerTimeToSeconds } from "../utils/prayerSchedule";
import {
  disableClosedAppPrayerAlerts,
  enableClosedAppPrayerAlerts,
  syncClosedAppPrayerAlertSelection,
} from "../api/prayerPushApi";
import { getDateInTimeZone } from "../utils/locationTime";
import { PRAYER_ALERT_NAMES, type PrayerAlertName } from "../utils/prayerAlerts";
import "./PrayerTimesView.css";

const prayerIcons: Record<string, React.ElementType> = {
  Fajr: Star,
  Sunrise: Sunrise,
  Dhuhr: Sun,
  Asr: CloudSun,
  Maghrib: Sunset,
  Isha: Moon,
};

const pad = (n: number) => String(n).padStart(2, "0");
const dateInputValue = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/** "HH:mm" or "HH:mm (EST)" -> minutes since midnight (NaN if unparseable). */
function toMinutes(t?: string): number {
  return prayerTimeToSeconds(t) / 60;
}

function formatTime(t: string, use12h: boolean): string {
  const mins = toMinutes(t);
  if (Number.isNaN(mins)) return t;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (!use12h) return `${pad(h)}:${pad(m)}`;
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "PM" : "AM"}`;
}

/** Ticks every second while `active`, so the countdown stays live. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/* ------------------------------------------------------------------ */
/* Asr method (Shafi'i vs Hanafi)                                      */
/* ------------------------------------------------------------------ */

type AsrSchool = "shafi" | "hanafi";
const SCHOOL_KEY = "ic.asrSchool";



/* ------------------------------------------------------------------ */
/* Place lookup (name + coordinates for the data being shown)          */
/* ------------------------------------------------------------------ */

interface Place {
  label: string;
  lat: number | null;
  lon: number | null;
  region: string | null;
}

interface GeoHit {
  lat?: string;
  lon?: string;
  address?: Record<string, string>;
}

const formatCoords = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? "N" : "S"}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? "E" : "W"}`;

async function fetchJson<T>(url: string, ms = 4500): Promise<T> {
  const ctl = new AbortController();
  const timer = window.setTimeout(() => ctl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function shortName(address: Record<string, string> = {}): string {
  const place = address.city || address.town || address.village || address.suburb || address.county;
  return [place, address.state, address.country].filter(Boolean).join(", ");
}

/** Never throws: falls back to coordinates / the typed text if the lookup fails. */
async function resolvePlace(location: ResolvedLocation, language: string): Promise<Place> {
  const base = "https://nominatim.openstreetmap.org";
  const locale = getContentLocale(language);
  if (location.type === "coords") {
    const { latitude: lat, longitude: lon } = location;
    const fallback = formatCoords(lat, lon);
    try {
      const hit = await fetchJson<GeoHit>(`${base}/reverse?format=jsonv2&zoom=10&accept-language=${locale}&lat=${lat}&lon=${lon}`);
      return { label: shortName(hit.address) || fallback, lat, lon, region: normalizeRegion(hit.address?.country_code) };
    } catch {
      return { label: fallback, lat, lon, region: null };
    }
  }

  const typed = `${location.city}, ${location.country}`;
  try {
    const hits = await fetchJson<GeoHit[]>(
      `${base}/search?format=jsonv2&limit=1&addressdetails=1&accept-language=${locale}&q=${encodeURIComponent(typed)}`
    );
    const hit = hits[0];
    if (hit?.lat && hit?.lon) {
      return {
        label: shortName(hit.address) || typed,
        lat: Number(hit.lat),
        lon: Number(hit.lon),
        region: normalizeRegion(hit.address?.country_code) ?? normalizeRegion(location.country),
      };
    }
  } catch {
    /* fall through */
  }
  return { label: typed, lat: null, lon: null, region: normalizeRegion(location.country) };
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

export default function PrayerTimesView() {
  const topRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<PrayerTimesResponse | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [lastLocation, setLastLocation] = useState<ResolvedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showSelector, setShowSelector] = useState(true);
  const [pushStatus, setPushStatus] = useState("");
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [showTimetable, setShowTimetable] = useState(false);
  const [timetableMonth, setTimetableMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [timetable, setTimetable] = useState<PrayerTimesResponse[]>([]);
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [timetableError, setTimetableError] = useState("");
  const [settings, setSettings] = useState(() => loadSettings());
  const [use12h, setUse12h] = useState(() => settings.prayer.timeFormat === "12h");
  const [school, setSchool] = useState<AsrSchool>(() => {
    try {
      return settings.prayer.asrSchool || (localStorage.getItem(SCHOOL_KEY) === "hanafi" ? "hanafi" : "shafi");
    } catch {
      return "hanafi";
    }
  });

  useEffect(() => {
    const handleSettingsUpdated = () => {
      const fresh = loadSettings();
      setSettings(fresh);
      setUse12h(fresh.prayer.timeFormat === "12h");
      if (fresh.prayer.asrSchool) {
        setSchool(fresh.prayer.asrSchool);
      }
    };
    window.addEventListener("ic:settingsUpdated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("ic:settingsUpdated", handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!showAlertSettings) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAlertSettings(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showAlertSettings]);

  const actualNow = useNow(Boolean(data));
  const now = useMemo(() => getDateInTimeZone(actualNow, data?.timeZone), [actualNow, data?.timeZone]);

  const handleResolve = async (location: ResolvedLocation, currentSchool = school) => {
    setLoading(true);
    setError("");
    setLastLocation(location);
    setShowTimetable(false);
    setTimetable([]);
    try {
      const method = settings.prayer.calculationMethod;
      const apiSchool = currentSchool === "hanafi" ? 1 : 0;
      const [response, resolved] = await Promise.all([
        location.type === "coords"
          ? getPrayerTimesByCoords(location.latitude, location.longitude, method, apiSchool)
          : getPrayerTimesByCity(location.city, location.country, method, apiSchool),
        resolvePlace(location, settings.general.appLanguage),
      ]);
      if (!response.data?.timings || typeof response.data.timings !== "object")
        throw new Error("Prayer times API returned an invalid response.");
      setData(response.data);
      try {
        localStorage.setItem("ic.prayerLocation", JSON.stringify(location));
        localStorage.setItem("ic.prayerLocationLabel", resolved.label);
        localStorage.setItem("ic.prayerTimesSnapshot", JSON.stringify({
          date: getDateInTimeZone(new Date(), response.data.timeZone).toDateString(),
          timeZone: response.data.timeZone,
          timings: response.data.timings,
        }));
      } catch {
        /* Home screen prayer times remain unavailable when storage is blocked. */
      }
      setPlace(resolved);
      saveRegion(resolved.region);
      if (settings.prayer.notificationsEnabled && resolved.lat !== null && resolved.lon !== null) {
        try {
          setPushStatus(await enableClosedAppPrayerAlerts({
            latitude: resolved.lat,
            longitude: resolved.lon,
            calculationMethod: method,
            school: apiSchool,
            timeZoneId: response.data.timeZone,
            prayerNames: settings.prayer.alertPrayers,
          }));
        } catch (pushError) {
          console.error("Unable to enable closed-app prayer alerts:", pushError);
          setPushStatus("Prayer times loaded. Reopen alert settings to retry closed-app notifications.");
        }
      }
      setShowSelector(false);
    } catch (err) {
      console.error("Failed to fetch prayer times:", err);
      setError(getFriendlyErrorMessage(err, "We couldn't load prayer times for that location. Please check the location and try again.", {
        offlineMessage: "Prayer times need an internet connection. Reconnect and try again.",
      }));
    } finally {
      setLoading(false);
    }
  };

  const chooseSchool = (value: AsrSchool) => {
    if (value === school) return;
    setSchool(value);
    try {
      localStorage.setItem(SCHOOL_KEY, value);
    } catch {
      /* storage unavailable */
    }
    if (lastLocation) {
      handleResolve(lastLocation, value);
    }
  };

  const updatePrayerPreferences = (patch: Partial<typeof settings.prayer>) => {
    const next = { ...settings, prayer: { ...settings.prayer, ...patch } };
    setSettings(next);
    saveSettings(next);
  };

  const enableAlertsForCurrentLocation = async (prayerNames = settings.prayer.alertPrayers) => {
    if (!data || place?.lat == null || place.lon == null) {
      setPushStatus("Select a location before enabling prayer notifications.");
      return;
    }
    setPushStatus(await enableClosedAppPrayerAlerts({
      latitude: place.lat,
      longitude: place.lon,
      calculationMethod: settings.prayer.calculationMethod,
      school: school === "hanafi" ? 1 : 0,
      timeZoneId: data.timeZone,
      prayerNames,
    }));
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (enabled) {
      if (!("Notification" in window)) {
        setPushStatus("Prayer notifications are not supported by this browser.");
        return;
      }
      const permission = Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== "granted") {
        setPushStatus("Prayer notifications are blocked. Allow them in your browser or device settings.");
        return;
      }
      updatePrayerPreferences({ notificationsEnabled: true });
      try {
        await enableAlertsForCurrentLocation();
      } catch (notificationError) {
        console.error("Unable to enable prayer notifications:", notificationError);
        setPushStatus("In-app alerts are enabled. Reopen alert settings to retry closed-app notifications.");
      }
      return;
    }

    updatePrayerPreferences({ notificationsEnabled: false });
    try {
      await disableClosedAppPrayerAlerts();
      setPushStatus("Prayer notifications are turned off.");
    } catch (notificationError) {
      console.error("Unable to disable prayer notifications:", notificationError);
      setPushStatus("Prayer notifications were turned off, but the browser subscription could not be removed.");
    }
  };

  const togglePrayerAlert = (prayer: PrayerAlertName) => {
    const prayerNames = settings.prayer.alertPrayers.includes(prayer)
      ? settings.prayer.alertPrayers.filter(name => name !== prayer)
      : PRAYER_ALERT_NAMES.filter(name => settings.prayer.alertPrayers.includes(name) || name === prayer);
    updatePrayerPreferences({ alertPrayers: prayerNames });
    if (settings.prayer.notificationsEnabled) {
      void syncClosedAppPrayerAlertSelection(prayerNames)
        .then(() => setPushStatus("Prayer alert selection updated."))
        .catch(notificationError => {
          console.error("Unable to update prayer alert selection:", notificationError);
          setPushStatus("Your selection was saved, but closed-app alerts could not be updated.");
        });
    }
  };

  const loadTimetable = async (month: Date) => {
    if (!lastLocation) return;
    setTimetableLoading(true);
    setTimetableError("");
    const method = settings.prayer.calculationMethod;
    const apiSchool = school === "hanafi" ? 1 : 0;
    try {
      const response = lastLocation.type === "coords"
        ? await getPrayerTimetableByCoords(
          lastLocation.latitude, lastLocation.longitude, month.getFullYear(), month.getMonth() + 1, method, apiSchool)
        : await getPrayerTimetableByCity(
          lastLocation.city, lastLocation.country, month.getFullYear(), month.getMonth() + 1, method, apiSchool);
      setTimetable(response.data);
    } catch (timetableFailure) {
      console.error("Failed to load prayer timetable:", timetableFailure);
      setTimetableError(getFriendlyErrorMessage(
        timetableFailure,
        "We couldn't load the prayer timetable. Please try again.",
        { offlineMessage: "The prayer timetable needs an internet connection." },
      ));
    } finally {
      setTimetableLoading(false);
    }
  };

  const changeTimetableMonth = (offset: number) => {
    const next = new Date(timetableMonth.getFullYear(), timetableMonth.getMonth() + offset, 1);
    setTimetableMonth(next);
    void loadTimetable(next);
  };
  const goToTimetableDate = (date: Date) => {
    const next = new Date(date.getFullYear(), date.getMonth(), 1);
    setTimetableMonth(next);
    void loadTimetable(next);
  };

  const timings = useMemo(() => data?.timings ?? {}, [data]);
  const applied = school === "hanafi";

  const schedule = data ? getPrayerSchedule(timings, now) : null;
  const hrs = schedule ? Math.floor(schedule.remaining / 3600) : 0;
  const mins = schedule ? Math.floor((schedule.remaining % 3600) / 60) : 0;
  const secs = schedule ? schedule.remaining % 60 : 0;

  useEffect(() => {
    if (!data || !settings.prayer.notificationsEnabled || !("Notification" in window) ||
      Notification.permission !== "granted") return;
    let cancelled = false;
    const timers: number[] = [];
    const scheduleFallback = async () => {
      const pushSubscription = "serviceWorker" in navigator
        ? await navigator.serviceWorker.ready.then(registration => registration.pushManager.getSubscription())
        : null;
      if (pushSubscription || cancelled) return;
      DISPLAY_TIMINGS.filter(name =>
        name !== "Sunrise" && settings.prayer.alertPrayers.includes(name)
      ).forEach(name => {
        const prayerSeconds = prayerTimeToSeconds(timings[name]);
        const current = getDateInTimeZone(new Date(), data.timeZone);
        const nowSeconds = current.getHours() * 3600 + current.getMinutes() * 60 + current.getSeconds();
        const delay = (prayerSeconds - nowSeconds) * 1000;
        if (!Number.isFinite(delay) || delay <= 0) return;
        timers.push(window.setTimeout(() => {
          new Notification(`${name} prayer time`, {
            body: `${name} has begun for ${place?.label ?? "your selected location"}.`,
            icon: "/icon-192.png",
          });
          if (settings.prayer.soundEnabled) {
            const AudioContextClass = window.AudioContext ||
              (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (AudioContextClass) {
              const context = new AudioContextClass();
              const oscillator = context.createOscillator();
              const gain = context.createGain();
              oscillator.frequency.value = 660;
              gain.gain.setValueAtTime(0.08, context.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 1.2);
              oscillator.connect(gain).connect(context.destination);
              oscillator.start();
              oscillator.stop(context.currentTime + 1.2);
            }
          }
        }, delay));
      });
    };
    void scheduleFallback();
    return () => {
      cancelled = true;
      timers.forEach(timer => window.clearTimeout(timer));
    };
  }, [
    data,
    place?.label,
    settings.prayer.alertPrayers,
    settings.prayer.notificationsEnabled,
    settings.prayer.soundEnabled,
    timings,
  ]);

  return (
    <div className="ptv-container" ref={topRef}>
      <div className="ptv-card-wrapper">
        {(showSelector || !data) && <LocationSelector onResolve={handleResolve} loading={loading} />}

        {error && (
          <p className="ptv-error" role="alert">
            {error}
          </p>
        )}

        {data && (
          <div className="ptv-result">
            {/* Hero: next prayer + live countdown */}
            {schedule && (
              <section className="ptv-next-hero" aria-label="Next prayer">
                <GoldenSpiral className="ptv-hero-spiral" showGrid={false} />

                <div className="ptv-next-info">
                  <span className="ptv-next-tag">
                    <Sparkles size={14} aria-hidden="true" /> {schedule.current ? "Now Ongoing" : "Between Prayer Times"}
                  </span>
                  <h2 className="ptv-next-title" title={schedule.current ? "Ongoing prayer" : "No obligatory prayer is currently ongoing"}>
                    {schedule.current ?? `Next: ${schedule.next}`}
                  </h2>
                  <div className="ptv-next-subtitle">
                    {schedule.current && <>Next: </>}<strong>{schedule.next}</strong> at{" "}
                    <span className="ptv-time-value" data-no-translate data-preserve-font translate="no" lang="en" dir="ltr">
                      {formatTime(timings[schedule.next], use12h)}
                    </span>
                  </div>
                  {place && (
                    <span className="ptv-next-place" style={{ marginTop: "12px", color: "rgba(245, 247, 246, 0.85)" }}>
                      <MapPin size={14} aria-hidden="true" /> {place.label}
                    </span>
                  )}
                </div>

                <div className="ptv-countdown" role="timer" aria-label={`Time until ${schedule.next}`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--p-gold-soft)", opacity: 0.9 }}>
                      Time remaining
                    </span>
                    <div className="ptv-countdown-boxes" data-no-translate data-preserve-font translate="no" lang="en" dir="ltr">
                      <div><strong>{pad(hrs)}</strong><small>hrs</small></div>
                      <span aria-hidden="true">:</span>
                      <div><strong>{pad(mins)}</strong><small>min</small></div>
                      <span aria-hidden="true">:</span>
                      <div><strong>{pad(secs)}</strong><small>sec</small></div>
                    </div>
                  </div>
                  <div className="ptv-progress" aria-hidden="true">
                    <span style={{ width: `${Math.round(schedule.progress * 100)}%` }} />
                  </div>
                </div>
              </section>
            )}

            {/* Dates */}
            <div className="ptv-result-header">
              <div className="ptv-dates">
                <span className="ptv-gregorian">
                  {new Intl.DateTimeFormat(getInterfaceLocale(settings.general.appLanguage), {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  }).format(now)}
                </span>
                <span className="ptv-hijri">{formatHijriDate(now, settings.general.hijriAdjustment || 0, settings.general.appLanguage)}</span>
              </div>
            </div>

            {/* Location + calculation settings */}
            <section className="ptv-place" aria-label="Location and calculation settings">
              <div className="ptv-place-main">
                <span className="ptv-place-icon" aria-hidden="true">
                  <MapPin size={22} />
                </span>
                <div className="ptv-place-text">
                  <small>Prayer times for</small>
                  <strong>{place?.label ?? "Selected location"}</strong>
                  {place?.lat != null && place.lon != null && (
                    <span className="ptv-place-coords">{formatCoords(place.lat, place.lon)}</span>
                  )}
                </div>
              </div>

              <div className="ptv-place-controls">
                <div className="ptv-control">
                  <span id="ptv-asr-label">Asr method</span>
                  <div className="ptv-toggle" role="group" aria-labelledby="ptv-asr-label">
                    <button
                      type="button"
                      aria-pressed={school === "shafi"}
                      className={school === "shafi" ? "is-on" : ""}
                      onClick={() => chooseSchool("shafi")}
                      title="Shafi'i, Maliki and Hanbali: Asr begins when an object's shadow equals its height"
                    >
                      Shafi'i
                    </button>
                    <button
                      type="button"
                      aria-pressed={school === "hanafi"}
                      className={school === "hanafi" ? "is-on" : ""}
                      onClick={() => chooseSchool("hanafi")}
                      title="Hanafi: Asr begins when an object's shadow is twice its height"
                    >
                      Hanafi
                    </button>
                  </div>
                </div>

                <div className="ptv-control">
                  <span id="ptv-fmt-label">Time format</span>
                  <div className="ptv-toggle" role="group" aria-labelledby="ptv-fmt-label">
                    <button type="button" aria-pressed={!use12h} className={!use12h ? "is-on" : ""} onClick={() => setUse12h(false)}>
                      24h
                    </button>
                    <button type="button" aria-pressed={use12h} className={use12h ? "is-on" : ""} onClick={() => setUse12h(true)}>
                      12h
                    </button>
                  </div>
                </div>

                <button 
                  type="button" 
                  className="ptv-change" 
                  onClick={() => {
                    setShowSelector((v) => {
                      const next = !v;
                      if (next) {
                        setTimeout(() => {
                          topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }, 50);
                      }
                      return next;
                    });
                  }} 
                  aria-expanded={showSelector}
                >
                  {showSelector ? "Hide" : "Change location"}
                </button>
              </div>
            </section>

            <button type="button" className="ptv-alert-settings-trigger"
              onClick={() => setShowAlertSettings(true)} aria-haspopup="dialog"
              aria-expanded={showAlertSettings}>
              <span><Bell size={20} aria-hidden="true" /></span>
              <span>
                <strong>Prayer alert settings</strong>
                <small>
                  {settings.prayer.notificationsEnabled
                    ? <><span data-no-translate data-preserve-font>{settings.prayer.alertPrayers.length}</span>{" "}
                      <span>of 5 prayers selected</span></>
                    : "Notifications are off"}
                </small>
              </span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>

            {showAlertSettings && createPortal(<div className="ptv-alert-drawer-layer"
              onMouseDown={() => setShowAlertSettings(false)}>
              <aside className="ptv-alert-drawer" role="dialog" aria-modal="true"
                aria-labelledby="ptv-alert-settings-title"
                onMouseDown={event => event.stopPropagation()}>
                <header>
                  <div>
                    <span><Bell size={20} aria-hidden="true" /></span>
                    <div><strong id="ptv-alert-settings-title">Prayer alert settings</strong></div>
                  </div>
                  <button type="button" onClick={() => setShowAlertSettings(false)}
                    aria-label="Close prayer alert settings" autoFocus><X size={20} /></button>
                </header>

                <div className="ptv-alert-drawer-content">
                  <div className="ptv-alert-setting-row">
                    <div>
                      <strong><Bell size={17} /> Prayer Time Notifications</strong>
                    </div>
                    <label className="ptv-switch">
                      <input type="checkbox" checked={settings.prayer.notificationsEnabled}
                        onChange={event => void handleNotificationToggle(event.target.checked)} />
                      <span aria-hidden="true" />
                    </label>
                  </div>

                  <fieldset className="ptv-alert-prayers" disabled={!settings.prayer.notificationsEnabled}>
                    <legend>Choose prayer alerts</legend>
                    <div>
                      {PRAYER_ALERT_NAMES.map(prayer => {
                        const selected = settings.prayer.alertPrayers.includes(prayer);
                        return <label className={selected ? "is-selected" : ""} key={prayer}>
                          <input type="checkbox" checked={selected} onChange={() => togglePrayerAlert(prayer)} />
                          <span>{prayer}</span>
                          <Check size={15} aria-hidden="true" />
                        </label>;
                      })}
                    </div>
                    {settings.prayer.alertPrayers.length === 0 &&
                      <small role="status">No prayer alerts selected.</small>}
                  </fieldset>

                  <div className="ptv-alert-setting-row">
                    <div>
                      <strong><Volume2 size={17} /> Prayer Alert Chime</strong>
                    </div>
                    <label className="ptv-switch">
                      <input type="checkbox" checked={settings.prayer.soundEnabled}
                        onChange={event => updatePrayerPreferences({ soundEnabled: event.target.checked })} />
                      <span aria-hidden="true" />
                    </label>
                  </div>
                  {pushStatus && <p className="ptv-drawer-status" role="status">{pushStatus}</p>}
                </div>
              </aside>
            </div>, document.body)}

            {/* Prayer timings */}
            <ul className="ptv-grid">
              {DISPLAY_TIMINGS.map(name => {
                const time = timings[name];
                if (!time) return null;
                const Icon = prayerIcons[name] ?? Sun;
                const sec = toMinutes(time) * 60;
                const alertEnabled = settings.prayer.notificationsEnabled
                  && settings.prayer.alertPrayers.some(prayer => prayer === name);
                const state =
                  schedule?.next === name 
                    ? "next" 
                    : schedule?.current === name
                      ? "ongoing"
                      : schedule && sec <= schedule.nowSec 
                        ? "passed" 
                        : "upcoming";

                return (
                  <li key={name} className={`ptv-prayer-card is-${state}`}>
                    {alertEnabled && <span className="ptv-prayer-alert" title="Notification enabled">
                      <Bell size={12} fill="currentColor" aria-hidden="true" />
                      <span>Alert on</span>
                    </span>}
                    <span className="ptv-prayer-icon" aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <span className="ptv-prayer-name">{name}</span>
                    <span className="ptv-prayer-time" data-no-translate data-preserve-font translate="no" lang="en" dir="ltr">
                      {formatTime(time, use12h)}
                    </span>
                    {(name === "Asr" || name === "Isha") && <span className="ptv-prayer-sub">{applied ? "Hanafi" : "Shafi'i"}</span>}
                    <span className="ptv-prayer-state">
                      {state === "next" && "Next"}
                      {state === "ongoing" && (
                        <>
                          <Sparkles size={12} aria-hidden="true" /> Ongoing
                        </>
                      )}
                      {state === "passed" && (
                        <>
                          <Check size={12} aria-hidden="true" /> Passed
                        </>
                      )}
                      {state === "upcoming" && "Upcoming"}
                    </span>
                  </li>
                );
              })}
            </ul>

            <section className="ptv-timetable">
              <button type="button" className="ptv-timetable-toggle" aria-expanded={showTimetable} onClick={() => {
                const next = !showTimetable;
                setShowTimetable(next);
                if (next && timetable.length === 0) void loadTimetable(timetableMonth);
              }}>
                <CalendarDays size={19} />
                {showTimetable ? "Hide Namaz timetable" : "View monthly Namaz timetable"}
              </button>
              {showTimetable && <div className="ptv-timetable-panel">
                <div className="ptv-timetable-header">
                  <button type="button" aria-label="Previous timetable month" onClick={() => changeTimetableMonth(-1)}>
                    <ChevronLeft />
                  </button>
                  <strong>{timetableMonth.toLocaleDateString(
                    getInterfaceLocale(settings.general.appLanguage),
                    { month: "long", year: "numeric" },
                  )}</strong>
                  <button type="button" aria-label="Next timetable month" onClick={() => changeTimetableMonth(1)}>
                    <ChevronRight />
                  </button>
                </div>
                <div className="ptv-timetable-jump">
                  <button type="button" onClick={() => goToTimetableDate(new Date())}>Go to today</button>
                  <label><span>Go to custom date</span><input type="date" value={dateInputValue(timetableMonth)} onChange={event => {
                    if (!event.target.value) return;
                    const [year, month, day] = event.target.value.split("-").map(Number);
                    goToTimetableDate(new Date(year, month - 1, day));
                  }} /></label>
                </div>
                {timetableError && <p className="ptv-error" role="alert">{timetableError}</p>}
                {timetableLoading ? <p className="ptv-timetable-loading">Loading timetable…</p> : timetable.length > 0 && (
                  <div className="ptv-timetable-scroll">
                    <table>
                      <thead><tr><th>Date</th>{DISPLAY_TIMINGS.map(name => <th key={name}>{name}</th>)}</tr></thead>
                      <tbody>{timetable.map(day => <tr key={day.date}>
                        <th scope="row"><span>{day.date}</span><small>{day.hijriDate}</small></th>
                        {DISPLAY_TIMINGS.map(name => <td key={name} data-no-translate data-preserve-font
                          translate="no" lang="en" dir="ltr">{formatTime(day.timings[name] ?? "-", use12h)}</td>)}
                      </tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>}
            </section>

            <p className="ptv-note">
              {applied
                ? "Asr is calculated using the Hanafi method (shadow length = 2× object's height) and Isha follows the 18° twilight convention."
                : "Timings follow standard conventions used by the Shafi'i, Maliki, and Hanbali schools (Asr shadow length = 1× object's height)."}
            </p>
          </div>
        )}

        {!data && !loading && !error && (
          <div className="ptv-placeholder">
            <GoldenSpiral className="ptv-placeholder-spiral" showGrid={false} />
            <p>Choose your location above to see today's prayer times.</p>
          </div>
        )}
      </div>
    </div>
  );
}
