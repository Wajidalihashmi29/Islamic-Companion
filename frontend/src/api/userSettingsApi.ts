import axiosClient from "./axiosClient";
import type { AppSettings } from "../utils/settingsStorage";

export interface CloudSettingsResponse {
  settingsJson?: string | null;
}

export interface CloudSettingsUpdateRequest {
  settingsJson: string;
}

/**
 * Fetches the user's saved preferences from the backend database.
 * Returns null if user is not authenticated or has not saved settings to cloud yet.
 */
export async function fetchCloudSettings(): Promise<AppSettings | null> {
  try {
    const res = await axiosClient.get<CloudSettingsResponse>("/user/settings");
    if (res.data?.settingsJson) {
      return JSON.parse(res.data.settingsJson) as AppSettings;
    }
    return null;
  } catch (err) {
    // 401 Unauthorized or network unreachable
    return null;
  }
}

/**
 * Saves preferences to the backend database under the authenticated user's account.
 */
export async function saveCloudSettings(settings: AppSettings): Promise<boolean> {
  try {
    await axiosClient.put("/user/settings", {
      settingsJson: JSON.stringify(settings),
    });
    return true;
  } catch (err) {
    console.warn("Failed to synchronize settings with cloud database:", err);
    return false;
  }
}
