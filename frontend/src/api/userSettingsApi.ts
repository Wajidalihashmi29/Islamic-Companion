import axiosClient from "./axiosClient";
import type { AppSettings } from "../utils/settingsStorage";
import type { SavedHadith, QuranPageNote } from "../utils/personalLibrary";
import type { QuranReaderView } from "../utils/quranNavigation";

export interface CloudUserData extends Partial<AppSettings> {
  quranPage?: number;
  quranView?: QuranReaderView;
  favoriteSurahs?: number[];
  hadithBookmarks?: SavedHadith[];
  recentHadiths?: SavedHadith[];
  quranNotes?: QuranPageNote[];
  azkarFavorites?: string[];
  calendarReminders?: string[];
  tasbeeh?: unknown;
  prayerTracker?: Record<string, string[]>;
  updatedAt?: string;
}

export interface CloudSettingsResponse {
  settingsJson?: string | null;
}

export interface CloudSettingsUpdateRequest {
  settingsJson: string;
}

/**
 * Fetches the user's saved preferences and library data from the backend database.
 * Returns null if user is not authenticated or has not saved settings to cloud yet.
 */
export async function fetchCloudSettings(): Promise<CloudUserData | null> {
  try {
    const res = await axiosClient.get<CloudSettingsResponse>("/user/settings");
    if (res.data?.settingsJson) {
      return JSON.parse(res.data.settingsJson) as CloudUserData;
    }
    return null;
  } catch (err) {
    // 401 Unauthorized or network unreachable
    return null;
  }
}

/**
 * Saves preferences and user data to the backend database under the authenticated user's account.
 */
export async function saveCloudSettings(payload: CloudUserData | AppSettings): Promise<boolean> {
  try {
    await axiosClient.put("/user/settings", {
      settingsJson: JSON.stringify(payload),
    });
    return true;
  } catch (err) {
    console.warn("Failed to synchronize settings with cloud database:", err);
    return false;
  }
}
