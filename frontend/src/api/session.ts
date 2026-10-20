import axios from "axios";
import { getTokenExpiryMs } from "../utils/tokenUtils";
import type { AuthResponse } from "./authApi";

export const SESSION_UPDATED_EVENT = "ic:sessionUpdated";
export const SESSION_ENDING_EVENT = "ic:sessionEnding";
const sessionClient = axios.create({ baseURL: import.meta.env.VITE_API_BASE_URL || "/api", timeout: 15_000 });
let pendingRefresh: Promise<string | null> | null = null;

export function clearStoredSession() {
  window.dispatchEvent(new Event(SESSION_ENDING_EVENT));
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("userName");
  window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
}

export function revokeSession(refreshToken: string) {
  return sessionClient.post("/auth/logout", { refreshToken });
}

export async function refreshSessionToken(rejectedToken?: string): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh;
  const renew = async () => {
    const token = localStorage.getItem("token");
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) return null;
    if (token && token !== rejectedToken && (getTokenExpiryMs(token) ?? 0) > Date.now() + 60_000) return token;
    try {
      const { data } = await sessionClient.post<AuthResponse>("/auth/refresh", { refreshToken });
      // A completed request must not restore a session that was signed out or replaced.
      if (localStorage.getItem("refreshToken") !== refreshToken) return localStorage.getItem("token");
      localStorage.setItem("token", data.token);
      localStorage.setItem("refreshToken", data.refreshToken);
      window.dispatchEvent(new Event(SESSION_UPDATED_EVENT));
      return data.token;
    } catch (error) {
      if (axios.isAxiosError(error) && [401, 403].includes(error.response?.status ?? 0)) {
        if (localStorage.getItem("refreshToken") === refreshToken) clearStoredSession();
      }
      throw error;
    }
  };
  // Serialize renewal to avoid unnecessary duplicate refresh requests.
  pendingRefresh = navigator.locks ? navigator.locks.request("ic:refresh-session", renew) : renew();
  try { return await pendingRefresh; }
  finally { pendingRefresh = null; }
}
