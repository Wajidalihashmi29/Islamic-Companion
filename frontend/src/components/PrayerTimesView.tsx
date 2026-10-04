import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CloudSun, MapPin, Moon, Sparkles, Star, Sun, Sunrise, Sunset } from "lucide-react";
import LocationSelector from "./LocationSelector";
import type { ResolvedLocation } from "./LocationSelector";
import { getPrayerTimesByCity, getPrayerTimesByCoords } from "../api/prayerTimesApi";
import type { PrayerTimesResponse } from "../api/prayerTimesApi";
import GoldenSpiral from "./GoldenSpiral";
import "./PrayerTimesView.css";

const prayerIcons: Record<string, React.ElementType> = {
  Fajr: Star,
  Sunrise: Sunrise,
  Dhuhr: Sun,
  Asr: CloudSun,
  Maghrib: Sunset,
  Isha: Moon,
};

const MAIN_PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"];
const DAY = 86400;
const pad = (n: number) => String(n).padStart(2, "0");

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/** "HH:mm" or "HH:mm (EST)" -> minutes since midnight (NaN if unparseable). */
function toMinutes(t?: string): number {
  if (!t) return NaN;
  const [h, m] = t.split(" ")[0].split(":").map(Number);
  return h * 60 + m;
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
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function getSchedule(timings: Record<string, string>, now: Date) {
  const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const list = MAIN_PRAYERS.map((name) => ({ name, sec: toMinutes(timings[name]) * 60 })).filter(
    (p) => !Number.isNaN(p.sec)
  );
  if (!list.length) return null;

  const idx = list.findIndex((p) => p.sec > nowSec);
  const next = idx === -1 ? list[0] : list[idx];
  const nextSec = idx === -1 ? next.sec + DAY : next.sec;
  
  const prevIdx = idx === -1 ? list.length - 1 : idx > 0 ? idx - 1 : list.length - 1;
  const prev = list[prevIdx];
  const prevSec = idx === -1 ? prev.sec : idx > 0 ? prev.sec : prev.sec - DAY;

  const span = Math.max(1, nextSec - prevSec);
  return {
    current: prev.name,
    next: next.name,
    nowSec,
    remaining: Math.max(0, nextSec - nowSec),
    progress: Math.min(1, Math.max(0, (nowSec - prevSec) / span)),
  };
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
async function resolvePlace(location: ResolvedLocation): Promise<Place> {
  const base = "https://nominatim.openstreetmap.org";
  if (location.type === "coords") {
    const { latitude: lat, longitude: lon } = location;
    const fallback = formatCoords(lat, lon);
    try {
      const hit = await fetchJson<GeoHit>(`${base}/reverse?format=jsonv2&zoom=10&accept-language=en&lat=${lat}&lon=${lon}`);
      return { label: shortName(hit.address) || fallback, lat, lon };
    } catch {
      return { label: fallback, lat, lon };
    }
  }

  const typed = `${location.city}, ${location.country}`;
  try {
    const hits = await fetchJson<GeoHit[]>(
      `${base}/search?format=jsonv2&limit=1&addressdetails=1&accept-language=en&q=${encodeURIComponent(typed)}`
    );
    const hit = hits[0];
    if (hit?.lat && hit?.lon) {
      return { label: shortName(hit.address) || typed, lat: Number(hit.lat), lon: Number(hit.lon) };
    }
  } catch {
    /* fall through */
  }
  return { label: typed, lat: null, lon: null };
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
  const [use12h, setUse12h] = useState(false);
  const [school, setSchool] = useState<AsrSchool>(() => {
    try {
      return localStorage.getItem(SCHOOL_KEY) === "hanafi" ? "hanafi" : "shafi";
    } catch {
      return "shafi";
    }
  });

  const now = useNow(Boolean(data));

  const handleResolve = async (location: ResolvedLocation, currentSchool = school) => {
    setLoading(true);
    setError("");
    setLastLocation(location);
    try {
      const method = currentSchool === "hanafi" ? 1 : 2;
      const apiSchool = currentSchool === "hanafi" ? 1 : 0;
      const [response, resolved] = await Promise.all([
        location.type === "coords"
          ? getPrayerTimesByCoords(location.latitude, location.longitude, method, apiSchool)
          : getPrayerTimesByCity(location.city, location.country, method, apiSchool),
        resolvePlace(location),
      ]);
      setData(response.data);
      setPlace(resolved);
      setShowSelector(false);
    } catch {
      setError("Couldn't fetch prayer times for that location. Please try again.");
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

  const timings = data ? data.timings : {};
  const applied = school === "hanafi";

  const schedule = data ? getSchedule(timings, now) : null;
  const hrs = schedule ? Math.floor(schedule.remaining / 3600) : 0;
  const mins = schedule ? Math.floor((schedule.remaining % 3600) / 60) : 0;
  const secs = schedule ? schedule.remaining % 60 : 0;

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
                    <Sparkles size={14} aria-hidden="true" /> Ongoing: {schedule.current}
                  </span>
                  <h2 className="ptv-next-title" title="Next Prayer">{schedule.next}</h2>
                  <span className="ptv-next-time">{formatTime(timings[schedule.next], use12h)}</span>
                  {place && (
                    <span className="ptv-next-place">
                      <MapPin size={14} aria-hidden="true" /> {place.label}
                    </span>
                  )}
                </div>

                <div className="ptv-countdown" role="timer" aria-label={`Time until ${schedule.next}`}>
                  <div className="ptv-countdown-boxes">
                    <div><strong>{pad(hrs)}</strong><small>hrs</small></div>
                    <span aria-hidden="true">:</span>
                    <div><strong>{pad(mins)}</strong><small>min</small></div>
                    <span aria-hidden="true">:</span>
                    <div><strong>{pad(secs)}</strong><small>sec</small></div>
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
                <span className="ptv-gregorian">{data.date}</span>
                <span className="ptv-hijri">{data.hijriDate} AH</span>
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
              <p className="ptv-note">
                Prayer times are calculated and may differ slightly from local mosques, looking at the local mosque's timetable is recommended for accuracy.
              </p>
            </section>

            {/* Prayer timings */}
            <ul className="ptv-grid">
              {Object.entries(timings).map(([name, time]) => {
                const Icon = prayerIcons[name] ?? Sun;
                const sec = toMinutes(time) * 60;
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
                    <span className="ptv-prayer-icon" aria-hidden="true">
                      <Icon size={22} />
                    </span>
                    <span className="ptv-prayer-name">{name}</span>
                    <span className="ptv-prayer-time">{formatTime(time, use12h)}</span>
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
