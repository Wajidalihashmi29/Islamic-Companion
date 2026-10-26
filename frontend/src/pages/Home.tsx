import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BookOpen, BookOpenText, Check, Circle, CloudSun, MapPin, Moon, Sparkles, Star, Sun, Sunset,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { features, getFeature, getFeaturePath } from "../config/features";
import { useAuth } from "../context/AuthContext";
import { getStorageKeyForUser, loadSettings, queueCloudSave, syncCloudSettings } from "../utils/settingsStorage";
import { loadQuranReadingPage } from "../utils/quranNavigation";
import { formatHijriDate } from "../utils/hijriDate";
import { getInterfaceLocale } from "../i18n/interfaceTranslations";
import { getPrayerTimesByCity, getPrayerTimesByCoords } from "../api/prayerTimesApi";
import { getQuranDirectory, getQuranPage } from "../api/quranApi";
import { getPrayerSchedule, hasPrayerStarted } from "../utils/prayerSchedule";
import { distanceBetweenCoordinates, getDateInTimeZone } from "../utils/locationTime";
import TopNav from "../components/TopNav";
import ConfettiEffect from "../components/ConfettiEffect";
import "./Home.css";

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
const PRAYER_ICONS: Record<(typeof PRAYERS)[number], LucideIcon> = {
  Fajr: Star,
  Dhuhr: Sun,
  Asr: CloudSun,
  Maghrib: Sunset,
  Isha: Moon,
};
const DAILY_DUA = {
  arabic: "رَبِّ اغْفِرْ لِي وَارْحَمْنِي وَاهْدِنِي وَعَافِنِي وَارْزُقْنِي",
  translation: "My Lord, forgive me, have mercy on me, guide me, grant me well-being, and provide for me.",
};

interface PrayerSnapshot {
  date?: string;
  timeZone?: string;
  timings?: Record<string, string>;
}

type DashboardLocation =
  | { type: "coords"; latitude: number; longitude: number }
  | { type: "city"; city: string; country: string };

interface QuranProgressDetails {
  surahName: string;
  surahNameArabic: string;
  para: number;
  ruku: number;
}

function formatPrayerTime(value: string | undefined, use12h: boolean) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return "—";
  const hour = Number(match[1]);
  if (!use12h) return `${String(hour).padStart(2, "0")}:${match[2]}`;
  return `${hour % 12 || 12}:${match[2]} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatRemainingTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map(value => String(value).padStart(2, "0")).join(":");
}

function LiveCountdown({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const endsAt = Date.now() + seconds * 1000;
    const update = () => setRemaining(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  return formatRemainingTime(remaining);
}

async function resolveDashboardLocationLabel(location: DashboardLocation, language: string) {
  if (location.type === "city") return `${location.city}, ${location.country}`;
  const fallback = `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`;
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=${encodeURIComponent(language)}&lat=${location.latitude}&lon=${location.longitude}`,
      { signal: AbortSignal.timeout(4500), headers: { Accept: "application/json" } },
    );
    if (!response.ok) return fallback;
    const data = await response.json() as { address?: Record<string, string> };
    const address = data.address ?? {};
    return [
      address.city || address.town || address.village || address.suburb || address.county,
      address.state,
      address.country,
    ].filter(Boolean).join(", ") || fallback;
  } catch {
    return fallback;
  }
}

export default function Home() {
  const [searchParams] = useSearchParams();
  const { logout, user, userIdentifier } = useAuth();
  const navigate = useNavigate();
  const requestedView = searchParams.get("view");
  const [settings, setSettings] = useState(() => loadSettings());
  const [now, setNow] = useState(() => new Date());
  const [prayerSnapshot, setPrayerSnapshot] = useState<PrayerSnapshot>(() => {
    try {
      const snapshot = JSON.parse(localStorage.getItem("ic.prayerTimesSnapshot") || "{}") as PrayerSnapshot;
      return snapshot.date === new Date().toDateString() ? snapshot : {};
    } catch { return {}; }
  });
  const locationNow = useMemo(
    () => getDateInTimeZone(now, prayerSnapshot.timeZone),
    [now, prayerSnapshot.timeZone],
  );
  const todayKey = locationNow.toDateString();
  const profileKey = getStorageKeyForUser(userIdentifier);
  const trackerKey = `${profileKey}:prayer-tracker:${todayKey}`;
  const [completedPrayers, setCompletedPrayers] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(trackerKey) || "[]") as string[]; } catch { return []; }
  });
  const [showConfetti, setShowConfetti] = useState(false);
  const lastPage = useMemo(() => {
    try { return loadQuranReadingPage(profileKey) ?? 1; } catch { return 1; }
  }, [profileKey, settings]);
  const [quranProgress, setQuranProgress] = useState<QuranProgressDetails | null>(null);
  const [quranProgressUnavailable, setQuranProgressUnavailable] = useState(false);
  const [locationLabel, setLocationLabel] = useState(() => {
    try { return localStorage.getItem("ic.prayerLocationLabel") || ""; } catch { return ""; }
  });
  const [dashboardLocation, setDashboardLocation] = useState<DashboardLocation | null>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("ic.prayerLocation") || "null") as DashboardLocation | null;
      return saved?.type === "coords" || saved?.type === "city" ? saved : null;
    } catch {
      return null;
    }
  });
  const [locationRefreshing, setLocationRefreshing] = useState(false);
  const locationRequestId = useRef(0);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    let activeTrackerKey = trackerKey;
    let timer = 0;
    const tick = () => {
      const next = new Date();
      const nextDate = getDateInTimeZone(next, prayerSnapshot.timeZone).toDateString();
      const nextTrackerKey = `${profileKey}:prayer-tracker:${nextDate}`;
      if (nextTrackerKey !== activeTrackerKey) {
        activeTrackerKey = nextTrackerKey;
        try {
          setCompletedPrayers(JSON.parse(localStorage.getItem(nextTrackerKey) || "[]") as string[]);
        } catch {
          setCompletedPrayers([]);
        }
      }
      setNow(next);
      scheduleNextTick();
    };
    const scheduleNextTick = () => {
      const current = new Date();
      const delay = 60_000 - (current.getSeconds() * 1_000 + current.getMilliseconds());
      timer = window.setTimeout(tick, Math.max(250, delay));
    };
    scheduleNextTick();
    return () => window.clearInterval(timer);
  }, [prayerSnapshot.timeZone, profileKey, trackerKey]);

  useEffect(() => {
    const legacyFeature = requestedView ? getFeature(requestedView) : undefined;
    if (legacyFeature?.available) navigate(getFeaturePath(legacyFeature.id), { replace: true });
  }, [navigate, requestedView]);

  useEffect(() => {
    const handleSettingsUpdated = () => setSettings(loadSettings());
    window.addEventListener("ic:settingsUpdated", handleSettingsUpdated);
    return () => window.removeEventListener("ic:settingsUpdated", handleSettingsUpdated);
  }, []);

  useEffect(() => {
    if (userIdentifier && localStorage.getItem("token")) {
      void syncCloudSettings(userIdentifier);
    }
  }, [userIdentifier]);

  useEffect(() => {
    const handleTrackerUpdated = () => {
      try {
        setCompletedPrayers(JSON.parse(localStorage.getItem(trackerKey) || "[]") as string[]);
      } catch {
        setCompletedPrayers([]);
      }
    };
    window.addEventListener("ic:prayerTrackerUpdated", handleTrackerUpdated);
    return () => window.removeEventListener("ic:prayerTrackerUpdated", handleTrackerUpdated);
  }, [trackerKey]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getQuranPage(lastPage, settings.quran.preferredTranslation, settings.quran.mushafLines, controller.signal),
      getQuranDirectory(controller.signal),
    ]).then(([page, directory]) => {
      const firstSegment = page.lines.flatMap(line => line.segments)[0];
      if (!firstSegment) return;
      const surah = directory.surahs.find(item => item.number === firstSegment.surahNumber);
      setQuranProgress({
        surahName: surah?.name ?? `Surah ${firstSegment.surahNumber}`,
        surahNameArabic: surah?.nameArabic ?? `سورة ${firstSegment.surahNumber}`,
        para: page.juzNumber,
        ruku: firstSegment.rukuNumberInSurah,
      });
    }).catch(error => {
      if (!controller.signal.aborted) {
        console.error("Unable to load Quran reading details:", error);
        setQuranProgressUnavailable(true);
      }
    });
    return () => controller.abort();
  }, [lastPage, settings.quran.mushafLines, settings.quran.preferredTranslation]);

  const loadDashboardLocation = useCallback(async (location: DashboardLocation) => {
    const requestId = ++locationRequestId.current;
    setLocationRefreshing(true);
    const method = settings.prayer.calculationMethod;
    const school = settings.prayer.asrSchool === "hanafi" ? 1 : 0;
    try {
      const response = location.type === "coords"
        ? await getPrayerTimesByCoords(location.latitude, location.longitude, method, school)
        : await getPrayerTimesByCity(location.city, location.country, method, school);
      if (requestId !== locationRequestId.current || !response.data?.timings) return;
      const resolvedLocation = await resolveDashboardLocationLabel(location, "en");
      if (requestId !== locationRequestId.current) return;
      const snapshotDate = getDateInTimeZone(new Date(), response.data.timeZone).toDateString();
      const snapshot = {
        date: snapshotDate,
        timeZone: response.data.timeZone,
        timings: response.data.timings,
      };
      setPrayerSnapshot(snapshot);
      setLocationLabel(resolvedLocation);
      try {
        localStorage.setItem("ic.prayerLocation", JSON.stringify(location));
        localStorage.setItem("ic.prayerLocationLabel", resolvedLocation);
        localStorage.setItem("ic.prayerTimesSnapshot", JSON.stringify(snapshot));
      } catch {
        /* The dashboard still shows the loaded times when storage is unavailable. */
      }
    } catch (error) {
      if (requestId === locationRequestId.current) {
        console.error("Unable to load dashboard prayer times:", error);
      }
    } finally {
      if (requestId === locationRequestId.current) setLocationRefreshing(false);
    }
  }, [
    settings.prayer.asrSchool,
    settings.prayer.calculationMethod,
  ]);

  const refreshCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      console.error("Automatic location detection is not supported by this browser.");
      return;
    }
    setLocationRefreshing(true);
    navigator.geolocation.getCurrentPosition(
      position => setDashboardLocation({
        type: "coords",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      error => {
        setLocationRefreshing(false);
        console.error("Unable to refresh dashboard location:", error);
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (dashboardLocation) {
        void loadDashboardLocation(dashboardLocation);
      } else {
        refreshCurrentLocation();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [dashboardLocation, loadDashboardLocation, refreshCurrentLocation]);

  useEffect(() => {
    if (dashboardLocation?.type !== "coords" || !navigator.geolocation) return;
    let lastCoordinates = dashboardLocation;
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const nextCoordinates = {
          type: "coords" as const,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        if (distanceBetweenCoordinates(lastCoordinates, nextCoordinates) < 1_000) return;
        lastCoordinates = nextCoordinates;
        setDashboardLocation(nextCoordinates);
      },
      error => {
        if (error.code !== error.PERMISSION_DENIED) {
          console.error("Unable to track dashboard location:", error);
        }
      },
      { enableHighAccuracy: false, timeout: 30_000, maximumAge: 60_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [dashboardLocation]);

  const locale = getInterfaceLocale(settings.general.appLanguage);
  const currentDateString = locationNow.toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric" });
  const hijriDateString = formatHijriDate(locationNow, settings.general.hijriAdjustment || 0, settings.general.appLanguage);
  const schedule = getPrayerSchedule(prayerSnapshot.timings, locationNow);
  const currentPrayer = schedule?.current ?? (schedule ? "Between Prayer Times" : "Prayer times unavailable");
  const countdownTarget = schedule?.current === "Fajr" ? "Sunrise" : schedule?.next;
  const countdownRemaining = schedule?.current === "Fajr"
    ? Math.max(0, schedule.periodEnd - schedule.nowSec)
    : schedule?.remaining;
  const availableCompletedPrayers = completedPrayers.filter(prayer =>
    PRAYERS.includes(prayer as (typeof PRAYERS)[number]) &&
    hasPrayerStarted(prayerSnapshot.timings, prayer as (typeof PRAYERS)[number], locationNow)
  );
  const handleConfettiComplete = useCallback(() => {
    setShowConfetti(false);
  }, []);

  const togglePrayer = (prayer: string) => {
    if (!PRAYERS.includes(prayer as (typeof PRAYERS)[number]) ||
      !hasPrayerStarted(prayerSnapshot.timings, prayer as (typeof PRAYERS)[number], locationNow)) return;

    const isChecking = !completedPrayers.includes(prayer);
    const next = isChecking
      ? [...completedPrayers, prayer]
      : completedPrayers.filter(item => item !== prayer);

    setCompletedPrayers(next);
    localStorage.setItem(trackerKey, JSON.stringify(next));
    queueCloudSave(userIdentifier);

    if (!isChecking) {
      setShowConfetti(false);
      return;
    }

    const isNowAllDone = PRAYERS.every(p => next.includes(p));
    const wasAllDone = PRAYERS.every(p => completedPrayers.includes(p));
    if (isNowAllDone && !wasAllDone) {
      setShowConfetti(true);
    }
  };

  return <div className="home-page">
    <TopNav activeView="dashboard" onViewChange={view => navigate(getFeaturePath(view))}
      onLogout={() => { logout(); navigate("/"); }} onSettingsClick={() => navigate("/settings")} />
    <main className="home-content">
      <div className="home-main home-dashboard">
        <section className="dashboard-hero">
          <div className="dashboard-welcome">
            {locationLabel && <button type="button"
              className={`dashboard-location${locationRefreshing ? " is-loading" : ""}`}
              onClick={refreshCurrentLocation}
              aria-label="Refresh current location"
              aria-busy={locationRefreshing}
              title={`${locationLabel} — click to refresh`}
              data-no-translate data-preserve-font translate="no" lang="en" dir="ltr">
              <MapPin size={14} aria-hidden="true" />
              <span>{locationLabel}</span>
            </button>}
            <span><span>Assalamu Alaikum</span>{user?.name ? `, ${user.name}` : ""}</span>
            <small>Current prayer</small>
            <strong>{currentPrayer}</strong>
            {schedule && countdownRemaining !== undefined && <div className="dashboard-countdown">
              <span>Next prayer</span>
              <strong>{countdownTarget}</strong>
              <span>starts in</span>
              <b data-no-translate data-preserve-font lang="en" dir="ltr">
                <LiveCountdown seconds={countdownRemaining} />
              </b>
            </div>}
            <div><span>{currentDateString}</span><span><Moon size={14} /> {hijriDateString}</span></div>
          </div>
          <div className="dashboard-prayers" aria-label="Today's prayer times">
            {PRAYERS.map((prayer, index) => {
              const PrayerIcon = PRAYER_ICONS[prayer];
              return <Link to="/prayer" key={prayer}>
                <span className={`dashboard-prayer-orb tone-${index}`}><PrayerIcon size={19} /></span>
                <strong>{prayer}</strong>
                <small className="dashboard-prayer-time" data-no-translate data-preserve-font lang="en" dir="ltr">
                  {formatPrayerTime(prayerSnapshot.timings?.[prayer], settings.prayer.timeFormat === "12h")}
                </small>
              </Link>;
            })}
          </div>
        </section>

        <nav className="dashboard-shortcuts" aria-label="Faith tools">
          {features.map(({ id, shortLabel, icon: Icon, available }) => <button type="button" key={id}
            disabled={!available} onClick={() => navigate(getFeaturePath(id))}>
            <span><Icon /></span><small>{shortLabel}</small>
          </button>)}
        </nav>

        <div className="dashboard-grid">
          <Link className="dashboard-last-read" to={`/quran?page=${lastPage}`}>
            <div><span>Last Read</span><strong>Continue Qur'an</strong>
              <small className="dashboard-reading-details">
                {quranProgress
                  ? <><span>Surah</span> <span className="dashboard-surah-name" data-no-translate
                    lang={settings.general.appLanguage === "ur" ? "ar" : "en"}>
                    {settings.general.appLanguage === "ur" ? quranProgress.surahNameArabic : quranProgress.surahName}
                  </span><i>•</i><span>Para</span> {quranProgress.para}
                    <i>•</i><span>Ruku</span> {quranProgress.ruku}</>
                  : <span>{quranProgressUnavailable ? "Open Qur'an to view reading details" : "Loading reading details"}</span>}
              </small>
              <b>Continue <ArrowRight size={15} /></b></div>
            <BookOpen aria-hidden="true" />
          </Link>

          <Link className="dashboard-last-read dashboard-quran-offline" to="/quran-pdf">
            <div><span>Offline Reader</span><strong>Qur'an Offline</strong>
              <small className="dashboard-reading-details">
                <span>Read the complete Qur'an as a PDF — no internet needed</span>
              </small>
              <b>Open <ArrowRight size={15} /></b></div>
            <BookOpenText aria-hidden="true" />
          </Link>

          <section className="dashboard-tracker">
            <header><div><span>Prayer Tracker</span><strong>{availableCompletedPrayers.length} <span>of 5 completed</span></strong></div>
              <small>{currentDateString}</small></header>
            <div>{PRAYERS.map(prayer => {
              const available = hasPrayerStarted(prayerSnapshot.timings, prayer, locationNow);
              const complete = available && completedPrayers.includes(prayer);
              return <button type="button" className={complete ? "is-complete" : ""} key={prayer}
                aria-pressed={complete} disabled={!available}
                title={!available ? "This prayer can be marked after its start time." : undefined}
                onClick={() => togglePrayer(prayer)}>
                {complete ? <Check /> : <Circle />}<span>{prayer}</span>
              </button>;
            })}</div>
          </section>

          <section className="dashboard-dua">
            <header><span><Sparkles size={16} /> Daily Dua</span><small>For guidance and well-being</small></header>
            <p className="dashboard-dua-arabic" data-no-translate lang="ar" dir="rtl">{DAILY_DUA.arabic}</p>
            <p>{DAILY_DUA.translation}</p>
          </section>
        </div>
      </div>
    </main>
    {showConfetti && <ConfettiEffect onComplete={handleConfettiComplete} />}
  </div>;
}
