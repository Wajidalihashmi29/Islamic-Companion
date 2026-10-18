import { jwtDecode } from "jwt-decode";
import { fetchCloudSettings, saveCloudSettings } from "../api/userSettingsApi";
import { DEFAULT_QURAN_TYPOGRAPHY, normalizeQuranTypography } from "./quranTypography";

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
  { id: "kanzul-iman-ur", name: "Kanzul Iman — Ala Hazrat Imam Ahmad Raza Khan Barelvi", lang: "Urdu", recommended: true, disabled: false },
  { id: "kanzul-iman-en", name: "The Treasure of Faith (Kanzul Iman English) — Prof. Shah Farid-ul-Haque", lang: "English", disabled: false },
  { id: "irfan-ul-quran-ur", name: "Irfan-ul-Quran — Shaykh-ul-Islam Dr. Muhammad Tahir-ul-Qadri", lang: "Urdu", disabled: false },
  { id: "kanzul-iman-hi", name: "Kanzul Iman (Hindi Devanagari) — Imam Ahmad Raza Khan", lang: "Hindi", disabled: true, sub: "Unavailable: authorized, verified dataset pending" },
];

export const TAFSEER_OPTIONS = [
  { id: "khazain-ul-irfan", name: "Khazain-ul-Irfan — Sadr-ul-Afadhil Mawlana Naeemuddin Muradabadi", lang: "Urdu", disabled: true, sub: "Unavailable: authorized, verified dataset pending" },
];

export const RECITERS_OPTIONS = [
  { id: "alafasy", name: "Mishary Rashid Alafasy", sub: "Clear & Melodic" },
  { id: "abdul-basit", name: "Abdul Basit Abdus Samad", sub: "Classic Mujawwad / Murattal" },
  { id: "husary", name: "Mahmoud Khalil Al-Husary", sub: "Master of Tajweed" },
  { id: "minshawi", name: "Muhammad Siddiq Al-Minshawi", sub: "Deep Spiritual Tone" },
  { id: "shuraim", name: "Saud Al-Shuraim", sub: "Former Imam of Masjid al-Haram" },
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
    mushafLines: 16,
    showTranslation: true,
    preferredTranslation: "kanzul-iman-ur",
    preferredTafseer: "khazain-ul-irfan",
    arabicScript: "indopak",
    ...DEFAULT_QURAN_TYPOGRAPHY,
    reciter: "alafasy",
  },
  prayer: {
    asrSchool: "hanafi",
    timeFormat: "12h",
    calculationMethod: 1,
    notificationsEnabled: true,
    soundEnabled: false,
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
    const quran = { ...DEFAULT_SETTINGS.quran, ...(parsed.quran || {}), ...normalizeQuranTypography(parsed.quran || {}) };

    return {
      quran,
      prayer: { ...DEFAULT_SETTINGS.prayer, ...(parsed.prayer || {}) },
      general: { ...DEFAULT_SETTINGS.general, ...(parsed.general || {}) },
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

let cloudSaveTimeout: ReturnType<typeof setTimeout> | null = null;

function queueCloudSave(settings: AppSettings) {
  if (cloudSaveTimeout) {
    clearTimeout(cloudSaveTimeout);
  }
  cloudSaveTimeout = setTimeout(() => {
    saveCloudSettings(settings).catch(() => {});
  }, 350);
}

/**
 * Saves preferences for the specified user, or the currently logged-in user if not specified.
 * Ensures isolation: logged-in user's settings are saved to their account-scoped key
 * AND automatically synchronized to the cloud database in the background.
 */
export function saveSettings(settings: AppSettings, userIdentifier?: string | null): void {
  try {
    const identifier =
      userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
    const key = getStorageKeyForUser(identifier);
    const serialized = JSON.stringify(settings);

    localStorage.setItem(key, serialized);

    // If guest, update both the guest key and legacy key for full compatibility
    if (!identifier) {
      localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
      localStorage.setItem(GUEST_STORAGE_KEY, serialized);
    }

    // Keep legacy Asr school in sync for existing prayer components
    if (settings.prayer?.asrSchool) {
      localStorage.setItem("ic.asrSchool", settings.prayer.asrSchool);
    }

    // If authenticated user, automatically synchronize to the backend cloud database!
    if (identifier && localStorage.getItem("token")) {
      queueCloudSave(settings);
    }

    // Broadcast across windows / components
    window.dispatchEvent(
      new CustomEvent("ic:settingsUpdated", {
        detail: {
          settings,
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
      queueCloudSave(defaults);
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
 * Synchronizes user settings with the backend database.
 * If the user logs in from any browser or device, this pulls their cloud settings and
 * updates the local storage cache so all their preferences follow them everywhere!
 */
export async function syncCloudSettings(userIdentifier?: string | null): Promise<AppSettings | null> {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const cloud = await fetchCloudSettings();
    const identifier = userIdentifier !== undefined ? userIdentifier : getActiveUserIdentifier();
    const key = getStorageKeyForUser(identifier);

    if (cloud) {
      const merged: AppSettings = {
        quran: { ...DEFAULT_SETTINGS.quran, ...(cloud.quran || {}), ...normalizeQuranTypography(cloud.quran || {}) },
        prayer: { ...DEFAULT_SETTINGS.prayer, ...(cloud.prayer || {}) },
        general: { ...DEFAULT_SETTINGS.general, ...(cloud.general || {}) },
      };
      localStorage.setItem(key, JSON.stringify(merged));
      if (merged.prayer?.asrSchool) {
        localStorage.setItem("ic.asrSchool", merged.prayer.asrSchool);
      }
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
      return merged;
    } else {
      // First time saving to cloud for this user: seed cloud with current settings
      const local = loadSettings(identifier);
      await saveCloudSettings(local);
      return local;
    }
  } catch (err) {
    console.warn("Cloud settings synchronization deferred:", err);
    return null;
  }
}
