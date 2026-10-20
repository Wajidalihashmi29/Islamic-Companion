import { jwtDecode } from "jwt-decode";
import { fetchCloudSettings, saveCloudSettings, type CloudUserData } from "../api/userSettingsApi";
import { DEFAULT_QURAN_TYPOGRAPHY, normalizeQuranTypography } from "./quranTypography";
import { DEFAULT_QURAN_RECITER, normalizeReciter } from "./quranReciters";
import { getQuranOfflineCompletionKey } from "./quranOffline";
import { getOfflineQuranPreferencePatch } from "./offlineQuranPreferences";
import { normalizePrayerAlertNames, PRAYER_ALERT_NAMES, type PrayerAlertName } from "./prayerAlerts";
import type { SavedHadith, QuranPageNote } from "./personalLibrary";
import type { QuranReaderView } from "./quranNavigation";

export { normalizeReciter, RECITERS_OPTIONS } from "./quranReciters";

const FIXED_MUSHAF_LINES = 16 as const;

export interface QuranPreferences {
  mushafLines: 16 | 15;
  showTranslation: boolean;
  preferredTranslation: string;
  preferredTafseer: string;
  arabicScript: "indopak" | "uthmani";
  arabicFontSize: number;
  translationFontSize: number;
  typographyVersion?: number;
  reciter: string;
}

export interface PrayerPreferences {
  asrSchool: "hanafi" | "shafi";
  timeFormat: "12h" | "24h";
  calculationMethod: number;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  alertPrayers: PrayerAlertName[];
}

export interface GeneralPreferences {
  hijriAdjustment: number;
  appLanguage: string;
}

export interface AppSettings {
  quran: QuranPreferences;
  prayer: PrayerPreferences;
  general: GeneralPreferences;
}

export const TRANSLATION_OPTIONS = [
  { id: "kanzul-iman-ur", name: "Kanzul Iman — Ala Hazrat Imam Ahmad Raza Khan (May Allah have mercy on him)", lang: "Urdu", recommended: true, disabled: false },
  { id: "kanzul-iman-en", name: "The Treasure of Faith (Kanzul Iman English) — Prof. Shah Farid-ul-Haque", lang: "English", disabled: false },
  { id: "irfan-ul-quran-ur", name: "Irfan-ul-Quran — Dr. Muhammad Tahir-ul-Qadri", lang: "Urdu", disabled: false },
  { id: "kanzul-iman-hi", name: "Kanzul Iman (Hindi Devanagari) — Imam Ahmad Raza Khan", lang: "Hindi", disabled: true, sub: "Unavailable: authorized, verified dataset pending" },
];

export const TAFSEER_OPTIONS = [
  { id: "sirat-ul-jinan", name: "Sirat-ul-Jinan — Mufti Muhammad Qasim Attari", lang: "Urdu", disabled: false },
];

export const CALCULATION_METHODS = [
  { id: 1, name: "University of Islamic Sciences, Karachi (Hanafi standard)" },
  { id: 2, name: "Islamic Society of North America (ISNA)" },
  { id: 3, name: "Muslim World League (MWL)" },
  { id: 4, name: "Umm al-Qura University, Makkah" },
  { id: 5, name: "Egyptian General Authority of Survey" },
];

export const DEFAULT_SETTINGS: AppSettings = {
  quran: {
    mushafLines: FIXED_MUSHAF_LINES,
    showTranslation: false,
    preferredTranslation: "kanzul-iman-ur",
    preferredTafseer: "sirat-ul-jinan",
    arabicScript: "indopak",
    ...DEFAULT_QURAN_TYPOGRAPHY,
    reciter: DEFAULT_QURAN_RECITER,
  },
  prayer: {
    asrSchool: "hanafi",
    timeFormat: "12h",
    calculationMethod: 1,
    notificationsEnabled: false,
    soundEnabled: true,
    alertPrayers: [...PRAYER_ALERT_NAMES],
  },
  general: {
    hijriAdjustment: 0,
    appLanguage: "en",
  },
};

const LEGACY_STORAGE_KEY = "ic.appSettings";
const GUEST_STORAGE_KEY = "ic.appSettings_guest";

/**
 * Returns the currently active authenticated user identifier (e.g. email, user id, or username),
 * or null if unauthenticated (guest).
 */
export function getActiveUserIdentifier(): string | null {
  try {
    const token = localStorage.getItem("token");
    if (token) {
      const decoded = jwtDecode<Record<string, unknown>>(token);
      const email =
        decoded.email ??
        decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
      if (typeof email === "string" && email.trim()) {
        return email.trim().toLowerCase();
      }
      const sub =
        decoded.sub ??
        decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ??
        decoded.nameid;
      if (typeof sub === "string" && sub.trim()) {
        return sub.trim().toLowerCase();
      }
    }
    const storedName = localStorage.getItem("userName");
    if (storedName && storedName.trim()) {
      return storedName.trim().toLowerCase();
    }
    return null;
  } catch {
    const storedName = localStorage.getItem("userName");
    return storedName ? storedName.trim().toLowerCase() : null;
  }
}

/**
 * Derives the exact localStorage key for a given user or guest profile.
 */
export function getStorageKeyForUser(userIdentifier?: string | null): string {
  const identifier =
    userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
  if (identifier && identifier.trim()) {
    return `ic.appSettings_user_${encodeURIComponent(identifier.trim().toLowerCase())}`;
  }
  return GUEST_STORAGE_KEY;
}

export interface UserSettingsProfileInfo {
  isGuest: boolean;
  identifier: string | null;
  storageKey: string;
}

export function getUserSettingsProfile(userIdentifier?: string | null): UserSettingsProfileInfo {
  const id = userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
  return {
    isGuest: !id,
    identifier: id,
    storageKey: getStorageKeyForUser(id),
  };
}

/**
 * Loads preferences for the specified user, or the currently logged-in user if not specified.
 * If the user has just logged in and has no saved preferences yet, seamlessly migrates
 * any existing guest customizations so they are preserved in their new account profile.
 */
export function loadSettings(userIdentifier?: string | null): AppSettings {
  try {
    const identifier =
      userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
    const key = getStorageKeyForUser(identifier);

    let raw = localStorage.getItem(key);

    // If target key was not found and this is a logged-in user, check if we can migrate
    // from guest / legacy settings so the user keeps any tweaks made before signing in.
    if (!raw && identifier) {
      const guestRaw =
        localStorage.getItem(GUEST_STORAGE_KEY) ||
        localStorage.getItem(LEGACY_STORAGE_KEY);
      if (guestRaw) {
        raw = guestRaw;
        try {
          localStorage.setItem(key, guestRaw);
        } catch {
          // ignore storage quota
        }
      }
    }

    // If still not found and we're in guest mode, try legacy key
    if (!raw && !identifier) {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    }

    if (!raw) {
      // Sync legacy localStorage keys if they exist
      const legacyAsr = localStorage.getItem("ic.asrSchool");
      const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;
      if (legacyAsr === "hanafi" || legacyAsr === "shafi") {
        defaults.prayer.asrSchool = legacyAsr;
      }
      return defaults;
    }

    const parsed = JSON.parse(raw);
    const general = { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) };
    const quran = { ...DEFAULT_SETTINGS.quran, ...(parsed.quran || {}), ...normalizeQuranTypography(parsed.quran || {}) };
    quran.mushafLines = FIXED_MUSHAF_LINES;
    if (quran.preferredTafseer === "khazain-ul-irfan") quran.preferredTafseer = DEFAULT_SETTINGS.quran.preferredTafseer;
    quran.reciter = normalizeReciter(quran.reciter);
    const prayer = { ...DEFAULT_SETTINGS.prayer, ...(parsed.prayer || {}) };
    prayer.alertPrayers = normalizePrayerAlertNames(parsed.prayer?.alertPrayers);

    return {
      quran,
      prayer,
      general,
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

export function preserveOfflineQuranPreferencesForGuest(): void {
  try {
    const identifier = getActiveUserIdentifier();
    if (!identifier) return;
    const source = loadSettings(identifier);
    const completionKey = getQuranOfflineCompletionKey(
      source.quran.preferredTranslation,
      source.quran.mushafLines,
    );
    if (localStorage.getItem(completionKey) !== "complete") return;
    const guest = loadSettings(null);
    const patch = getOfflineQuranPreferencePatch(source);
    saveSettings({
      ...guest,
      quran: { ...guest.quran, ...patch.quran },
      general: { ...guest.general, ...patch.general },
    }, null);
  } catch {
    // Session logout must continue even when browser storage is unavailable.
  }
}

/**
 * Builds a complete user snapshot for cloud synchronization, including
 * app settings, reading progress, favorite Surahs, and personal library items.
 */
export function buildCloudPayload(userIdentifier?: string | null): CloudUserData {
  const identifier = userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
  const profileKey = getStorageKeyForUser(identifier);
  const settings = loadSettings(identifier);

  let quranPage: number | undefined;
  try {
    const rawPage = localStorage.getItem(`${profileKey}:quran-page`);
    if (rawPage) {
      const parsed = JSON.parse(rawPage);
      if (typeof parsed === "number" && parsed >= 1 && parsed <= 604) {
        quranPage = parsed;
      }
    }
  } catch {}

  let quranView: QuranReaderView | undefined;
  try {
    const rawView = localStorage.getItem(`${profileKey}:quran-view`);
    if (rawView) {
      quranView = JSON.parse(rawView);
    }
  } catch {}

  let favoriteSurahs: number[] | undefined;
  try {
    const rawFavs = localStorage.getItem(`${profileKey}:quran-favorite-surahs`);
    if (rawFavs) {
      const parsed = JSON.parse(rawFavs);
      if (Array.isArray(parsed)) {
        favoriteSurahs = parsed.filter(n => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 114);
      }
    }
  } catch {}

  let hadithBookmarks: SavedHadith[] | undefined;
  try {
    const raw = localStorage.getItem(`${profileKey}.hadithBookmarks`);
    if (raw) hadithBookmarks = JSON.parse(raw);
  } catch {}

  let recentHadiths: SavedHadith[] | undefined;
  try {
    const raw = localStorage.getItem(`${profileKey}.recentHadiths`);
    if (raw) recentHadiths = JSON.parse(raw);
  } catch {}

  let quranNotes: QuranPageNote[] | undefined;
  try {
    const raw = localStorage.getItem(`${profileKey}.quranNotes`);
    if (raw) quranNotes = JSON.parse(raw);
  } catch {}

  let azkarFavorites: string[] | undefined;
  try {
    const raw = localStorage.getItem(`${profileKey}.azkarFavorites`);
    if (raw) azkarFavorites = JSON.parse(raw);
  } catch {}

  let calendarReminders: string[] | undefined;
  try {
    const raw = localStorage.getItem(`${profileKey}.calendarReminders`);
    if (raw) calendarReminders = JSON.parse(raw);
  } catch {}

  let tasbeeh: unknown;
  try {
    const raw = localStorage.getItem(`${profileKey}.tasbeeh`);
    if (raw) tasbeeh = JSON.parse(raw);
  } catch {}

  return {
    ...settings,
    quranPage,
    quranView,
    favoriteSurahs: favoriteSurahs ?? [],
    hadithBookmarks: hadithBookmarks ?? [],
    recentHadiths: recentHadiths ?? [],
    quranNotes: quranNotes ?? [],
    azkarFavorites: azkarFavorites ?? [],
    calendarReminders: calendarReminders ?? [],
    tasbeeh,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Migrates local guest data (reading page, favorite surahs, library bookmarks)
 * to an authenticated user profile key when first signing in on this browser.
 */
export function migrateGuestDataToUser(identifier: string): void {
  try {
    const userKey = getStorageKeyForUser(identifier);
    const guestKey = GUEST_STORAGE_KEY;

    if (!localStorage.getItem(`${userKey}:quran-page`)) {
      const guestPage = localStorage.getItem(`${guestKey}:quran-page`) || localStorage.getItem("quran-page");
      if (guestPage) localStorage.setItem(`${userKey}:quran-page`, guestPage);
    }
    if (!localStorage.getItem(`${userKey}:quran-view`)) {
      const guestView = localStorage.getItem(`${guestKey}:quran-view`);
      if (guestView) localStorage.setItem(`${userKey}:quran-view`, guestView);
    }
    if (!localStorage.getItem(`${userKey}:quran-favorite-surahs`)) {
      const guestFavs = localStorage.getItem(`${guestKey}:quran-favorite-surahs`);
      if (guestFavs) localStorage.setItem(`${userKey}:quran-favorite-surahs`, guestFavs);
    }
    if (!localStorage.getItem(`${userKey}.hadithBookmarks`)) {
      const guestHadiths = localStorage.getItem(`${guestKey}.hadithBookmarks`);
      if (guestHadiths) localStorage.setItem(`${userKey}.hadithBookmarks`, guestHadiths);
    }
    if (!localStorage.getItem(`${userKey}.quranNotes`)) {
      const guestNotes = localStorage.getItem(`${guestKey}.quranNotes`);
      if (guestNotes) localStorage.setItem(`${userKey}.quranNotes`, guestNotes);
    }
    if (!localStorage.getItem(`${userKey}.azkarFavorites`)) {
      const guestAzkar = localStorage.getItem(`${guestKey}.azkarFavorites`);
      if (guestAzkar) localStorage.setItem(`${userKey}.azkarFavorites`, guestAzkar);
    }
    if (!localStorage.getItem(`${userKey}.calendarReminders`)) {
      const guestReminders = localStorage.getItem(`${guestKey}.calendarReminders`);
      if (guestReminders) localStorage.setItem(`${userKey}.calendarReminders`, guestReminders);
    }
    if (!localStorage.getItem(`${userKey}.tasbeeh`)) {
      const guestTasbeeh = localStorage.getItem(`${guestKey}.tasbeeh`);
      if (guestTasbeeh) localStorage.setItem(`${userKey}.tasbeeh`, guestTasbeeh);
    }
  } catch {
    // ignore
  }
}

let cloudSaveTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced background cloud sync. Automatically bundles user settings, reading progress,
 * favorite surahs, and personal library bookmarks to sync with the backend database.
 */
export function queueCloudSave(userIdentifierOrSettings?: string | null | AppSettings): void {
  const token = localStorage.getItem("token");
  if (!token) return;

  const identifier =
    typeof userIdentifierOrSettings === "string"
      ? userIdentifierOrSettings
      : getActiveUserIdentifier();
  if (!identifier) return;

  if (cloudSaveTimeout) {
    clearTimeout(cloudSaveTimeout);
  }
  cloudSaveTimeout = setTimeout(() => {
    try {
      const payload = buildCloudPayload(identifier);
      saveCloudSettings(payload).catch(() => {});
    } catch {
      // ignore
    }
  }, 400);
}

/**
 * Saves preferences for the specified user, or the currently logged-in user if not specified.
 * Ensures isolation: logged-in user's settings are saved to their account-scoped key
 * AND automatically synchronized to the cloud database in the background.
 */
export function saveSettings(settings: AppSettings, userIdentifier?: string | null): void {
  try {
    const normalizedSettings: AppSettings = {
      ...settings,
      quran: { ...settings.quran, mushafLines: FIXED_MUSHAF_LINES, reciter: normalizeReciter(settings.quran.reciter) },
    };
    const identifier =
      userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
    const key = getStorageKeyForUser(identifier);
    const serialized = JSON.stringify(normalizedSettings);

    localStorage.setItem(key, serialized);

    // If guest, update both the guest key and legacy key for full compatibility
    if (!identifier) {
      localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
      localStorage.setItem(GUEST_STORAGE_KEY, serialized);
    }

    // Keep legacy Asr school in sync for existing prayer components
    if (normalizedSettings.prayer?.asrSchool) {
      localStorage.setItem("ic.asrSchool", normalizedSettings.prayer.asrSchool);
    }

    // If authenticated user, automatically synchronize to the backend cloud database!
    if (identifier && localStorage.getItem("token")) {
      queueCloudSave(identifier);
    }

    // Broadcast across windows / components
    window.dispatchEvent(
      new CustomEvent("ic:settingsUpdated", {
        detail: {
          settings: normalizedSettings,
          userIdentifier: identifier,
          key,
        },
      })
    );
  } catch {
    // Storage quota or disabled in private browsing
  }
}

/**
 * Resets settings for the specified user (or active user) to defaults and broadcasts the change.
 * Also synchronizes the reset defaults to the cloud if logged in.
 */
export function resetSettings(userIdentifier?: string | null): AppSettings {
  const identifier =
    userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
  const key = getStorageKeyForUser(identifier);
  const defaults = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as AppSettings;

  try {
    localStorage.setItem(key, JSON.stringify(defaults));
    if (!identifier) {
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(defaults));
      localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(defaults));
    }

    if (identifier && localStorage.getItem("token")) {
      queueCloudSave(identifier);
    }

    window.dispatchEvent(
      new CustomEvent("ic:settingsUpdated", {
        detail: {
          settings: defaults,
          userIdentifier: identifier,
          key,
        },
      })
    );
  } catch {
    // ignore
  }

  return defaults;
}

/**
 * Synchronizes user settings, reading progress, and personal library with the backend database.
 * If the user logs in from any browser or device, this pulls their cloud data and
 * updates the local storage cache so all their reading progress and favorites follow them everywhere!
 */
export async function syncCloudSettings(userIdentifier?: string | null): Promise<AppSettings | null> {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const identifier = userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
    if (!identifier) return null;

    // Migrate any local guest customizations to this user profile if first time on this browser
    migrateGuestDataToUser(identifier);

    const cloud = await fetchCloudSettings();
    const key = getStorageKeyForUser(identifier);

    if (cloud) {
      // 1. AppSettings
      const merged: AppSettings = {
        quran: { ...DEFAULT_SETTINGS.quran, ...(cloud.quran || {}), ...normalizeQuranTypography(cloud.quran || {}) },
        prayer: { ...DEFAULT_SETTINGS.prayer, ...(cloud.prayer || {}) },
        general: { ...DEFAULT_SETTINGS.general, ...(cloud.general || {}) },
      };
      if (merged.quran.preferredTafseer === "khazain-ul-irfan")
        merged.quran.preferredTafseer = DEFAULT_SETTINGS.quran.preferredTafseer;
      merged.quran.mushafLines = FIXED_MUSHAF_LINES;
      merged.quran.reciter = normalizeReciter(merged.quran.reciter);
      localStorage.setItem(key, JSON.stringify(merged));
      if (merged.prayer?.asrSchool) {
        localStorage.setItem("ic.asrSchool", merged.prayer.asrSchool);
      }

      // 2. Quran Reading Page
      if (typeof cloud.quranPage === "number" && cloud.quranPage >= 1 && cloud.quranPage <= 604) {
        localStorage.setItem(`${key}:quran-page`, JSON.stringify(cloud.quranPage));
      }

      // 3. Quran View
      if (cloud.quranView) {
        localStorage.setItem(`${key}:quran-view`, JSON.stringify(cloud.quranView));
      }

      // 4. Favorite Surahs
      if (Array.isArray(cloud.favoriteSurahs)) {
        let localFavs: number[] = [];
        try {
          const raw = localStorage.getItem(`${key}:quran-favorite-surahs`);
          if (raw) localFavs = JSON.parse(raw);
        } catch {}
        const mergedFavs = Array.from(new Set([...localFavs, ...cloud.favoriteSurahs]))
          .filter(n => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 114)
          .sort((a, b) => a - b);
        localStorage.setItem(`${key}:quran-favorite-surahs`, JSON.stringify(mergedFavs));
      }

      // 5. Hadith Bookmarks
      if (Array.isArray(cloud.hadithBookmarks)) {
        let localHadiths: SavedHadith[] = [];
        try {
          const raw = localStorage.getItem(`${key}.hadithBookmarks`);
          if (raw) localHadiths = JSON.parse(raw);
        } catch {}
        const hadithMap = new Map<string, SavedHadith>();
        cloud.hadithBookmarks.forEach(h => { if (h && h.id) hadithMap.set(h.id, h); });
        localHadiths.forEach(h => { if (h && h.id && !hadithMap.has(h.id)) hadithMap.set(h.id, h); });
        localStorage.setItem(`${key}.hadithBookmarks`, JSON.stringify(Array.from(hadithMap.values())));
      }

      // 6. Recent Hadiths
      if (Array.isArray(cloud.recentHadiths)) {
        let localRecent: SavedHadith[] = [];
        try {
          const raw = localStorage.getItem(`${key}.recentHadiths`);
          if (raw) localRecent = JSON.parse(raw);
        } catch {}
        const recentMap = new Map<string, SavedHadith>();
        cloud.recentHadiths.forEach(h => { if (h && h.id) recentMap.set(h.id, h); });
        localRecent.forEach(h => { if (h && h.id && !recentMap.has(h.id)) recentMap.set(h.id, h); });
        localStorage.setItem(`${key}.recentHadiths`, JSON.stringify(Array.from(recentMap.values()).slice(0, 20)));
      }

      // 7. Quran Notes
      if (Array.isArray(cloud.quranNotes)) {
        let localNotes: QuranPageNote[] = [];
        try {
          const raw = localStorage.getItem(`${key}.quranNotes`);
          if (raw) localNotes = JSON.parse(raw);
        } catch {}
        const notesMap = new Map<number, QuranPageNote>();
        cloud.quranNotes.forEach(n => { if (n && typeof n.page === "number") notesMap.set(n.page, n); });
        localNotes.forEach(n => { if (n && typeof n.page === "number" && !notesMap.has(n.page)) notesMap.set(n.page, n); });
        localStorage.setItem(`${key}.quranNotes`, JSON.stringify(Array.from(notesMap.values())));
      }

      // 8. Azkar Favorites
      if (Array.isArray(cloud.azkarFavorites)) {
        let localAzkar: string[] = [];
        try {
          const raw = localStorage.getItem(`${key}.azkarFavorites`);
          if (raw) localAzkar = JSON.parse(raw);
        } catch {}
        const mergedAzkar = Array.from(new Set([...localAzkar, ...cloud.azkarFavorites]));
        localStorage.setItem(`${key}.azkarFavorites`, JSON.stringify(mergedAzkar));
      }

      // 9. Calendar Reminders
      if (Array.isArray(cloud.calendarReminders)) {
        let localReminders: string[] = [];
        try {
          const raw = localStorage.getItem(`${key}.calendarReminders`);
          if (raw) localReminders = JSON.parse(raw);
        } catch {}
        const mergedReminders = Array.from(new Set([...localReminders, ...cloud.calendarReminders]));
        localStorage.setItem(`${key}.calendarReminders`, JSON.stringify(mergedReminders));
      }

      // 10. Tasbeeh
      if (cloud.tasbeeh && typeof cloud.tasbeeh === "object") {
        localStorage.setItem(`${key}.tasbeeh`, JSON.stringify(cloud.tasbeeh));
      }

      // Broadcast updates to all listeners
      window.dispatchEvent(
        new CustomEvent("ic:settingsUpdated", {
          detail: {
            settings: merged,
            userIdentifier: identifier,
            key,
            fromCloud: true,
          },
        })
      );
      window.dispatchEvent(new Event("ic:libraryUpdated"));

      return merged;
    } else {
      // First time saving to cloud for this user: seed cloud with current settings & all local data
      const payload = buildCloudPayload(identifier);
      await saveCloudSettings(payload);
      return loadSettings(identifier);
    }
  } catch (err) {
    console.warn("Cloud settings synchronization deferred:", err);
    return null;
  }
}
