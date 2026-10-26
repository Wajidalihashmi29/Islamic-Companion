import { useEffect, useRef } from "react";
import { loadSettings } from "../utils/settingsStorage";
import { playPrayerChime, unlockPrayerChimeAudio } from "../utils/prayerChime";
import { MAIN_PRAYERS, prayerTimeToSeconds } from "../utils/prayerSchedule";
import { getDateInTimeZone } from "../utils/locationTime";

interface CachedPrayerSnapshot {
  date?: string;
  timeZone?: string;
  timings?: Record<string, string>;
}

/**
 * Global In-App Prayer Alarm Manager.
 * Runs continuously across the entire app at the root level, ensuring the
 * prayer alert chime and notifications fire reliably at exact prayer times
 * whether the user is on Home, Quran, PDF, Hadith, or Settings.
 */
export default function PrayerAlarmManager() {
  const alertedPrayersRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // 1. Listen for background push notifications forwarded from Service Worker
    if ("serviceWorker" in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data?.type === "PLAY_PRAYER_CHIME") {
          const currentSettings = loadSettings();
          if (currentSettings.prayer.soundEnabled) {
            void playPrayerChime(0.6);
          }
        }
      };

      navigator.serviceWorker.addEventListener("message", handleSwMessage);
      return () => {
        navigator.serviceWorker.removeEventListener("message", handleSwMessage);
      };
    }
  }, []);

  useEffect(() => {
    let timerId: number | null = null;

    const checkAndTriggerPrayers = () => {
      try {
        const raw = localStorage.getItem("ic.prayerTimesSnapshot");
        if (!raw) return;
        const snapshot = JSON.parse(raw) as CachedPrayerSnapshot;
        if (!snapshot.timings) return;

        const settings = loadSettings();
        const timeZone = snapshot.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;
        const now = getDateInTimeZone(new Date(), timeZone);
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        const currentSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

        const locationLabel = localStorage.getItem("ic.prayerLocationLabel") || "your selected location";

        MAIN_PRAYERS.forEach(prayerName => {
          const prayerTimeStr = snapshot.timings?.[prayerName];
          if (!prayerTimeStr) return;

          const prayerSeconds = prayerTimeToSeconds(prayerTimeStr);
          if (!Number.isFinite(prayerSeconds)) return;

          // Prayer time entrance window: within 4 minutes after the prayer start
          const timeDiff = currentSeconds - prayerSeconds;
          const isEnteringNow = timeDiff >= 0 && timeDiff < 240;

          const alertKey = `${todayStr}:${prayerName}`;

          if (isEnteringNow && !alertedPrayersRef.current.has(alertKey)) {
            alertedPrayersRef.current.add(alertKey);

            // 1. Play gentle prayer chime if enabled and prayer is selected for alerts
            const isAlertEnabledForPrayer = settings.prayer.alertPrayers.includes(prayerName);
            if (settings.prayer.soundEnabled && isAlertEnabledForPrayer) {
              unlockPrayerChimeAudio();
              void playPrayerChime(0.6);
            }

            // 2. Display notification safely if notifications enabled
            if (settings.prayer.notificationsEnabled && isAlertEnabledForPrayer) {
              const title = `${prayerName} prayer time`;
              const body = `${prayerName} has begun for ${locationLabel}.`;

              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready.then(reg => {
                  return reg.showNotification(title, {
                    body,
                    icon: "/icon-192.png",
                    badge: "/icon-192.png",
                    tag: `prayer-${prayerName.toLowerCase()}`,
                  });
                }).catch(() => {
                  try {
                    if ("Notification" in window && Notification.permission === "granted") {
                      new Notification(title, { body, icon: "/icon-192.png" });
                    }
                  } catch {}
                });
              } else {
                try {
                  if ("Notification" in window && Notification.permission === "granted") {
                    new Notification(title, { body, icon: "/icon-192.png" });
                  }
                } catch {}
              }
            }
          }
        });
      } catch (err) {
        console.warn("PrayerAlarmManager check error:", err);
      }
    };

    // Run immediately, then check every 15 seconds for exact prayer entrance
    checkAndTriggerPrayers();
    timerId = window.setInterval(checkAndTriggerPrayers, 15000);

    const handleSettingsUpdated = () => checkAndTriggerPrayers();
    window.addEventListener("ic:settingsUpdated", handleSettingsUpdated);
    window.addEventListener("storage", handleSettingsUpdated);

    return () => {
      if (timerId !== null) window.clearInterval(timerId);
      window.removeEventListener("ic:settingsUpdated", handleSettingsUpdated);
      window.removeEventListener("storage", handleSettingsUpdated);
    };
  }, []);

  return null;
}
