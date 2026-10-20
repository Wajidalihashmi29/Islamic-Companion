import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import {
  clearStoredSession,
  refreshSessionToken,
  revokeSession,
  SESSION_ENDING_EVENT,
  SESSION_UPDATED_EVENT,
} from "../api/session";
import {
  loadSettings,
  preserveOfflineQuranPreferencesForGuest,
  syncCloudSettings,
} from "../utils/settingsStorage";

export interface AuthUser {
  id?: string;
  name: string;
  email?: string;
}

export interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
  userIdentifier: string | null;
  login: (token: string, refreshToken: string, userName?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function emailFromToken(token: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const decoded = jwtDecode<Record<string, unknown>>(token);
    const email =
      decoded.email ??
      decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"];
    return typeof email === "string" ? email : undefined;
  } catch {
    return undefined;
  }
}

function idFromToken(token: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const decoded = jwtDecode<Record<string, unknown>>(token);
    const sub =
      decoded.sub ??
      decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"] ??
      decoded.nameid;
    return typeof sub === "string" ? sub : undefined;
  } catch {
    return undefined;
  }
}

function nameFromToken(token: string | null): string | undefined {
  if (!token) return undefined;
  try {
    const decoded = jwtDecode<Record<string, unknown>>(token);
    const name =
      decoded["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name"] ??
      decoded.name;
    return typeof name === "string" ? name : undefined;
  } catch {
    return undefined;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [userName, setUserName] = useState<string | null>(localStorage.getItem("userName"));

  const login = useCallback((newToken: string, newRefreshToken: string, name?: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("refreshToken", newRefreshToken);
    let resolvedName = name;
    if (!resolvedName) {
      resolvedName = nameFromToken(newToken);
    }
    if (resolvedName) {
      localStorage.setItem("userName", resolvedName);
      setUserName(resolvedName);
    }
    setToken(newToken);

    // Warm up settings and synchronize from cloud database for this user
    const email = emailFromToken(newToken);
    const id = idFromToken(newToken);
    const identifier = email || id || resolvedName || null;
    loadSettings(identifier);
    syncCloudSettings(identifier);
  }, []);

  useEffect(() => {
    if (token) {
      syncCloudSettings();
    }
  }, [token]);

  useEffect(() => {
    const sync = () => {
      const storedToken = localStorage.getItem("token");
      setToken(storedToken);
      setUserName(localStorage.getItem("userName"));
      if (!storedToken) window.dispatchEvent(new CustomEvent("ic:settingsUpdated", {
        detail: { settings: loadSettings(null), userIdentifier: null, key: "ic.appSettings_guest" },
      }));
    };
    const storageSync = (event: StorageEvent) => {
      if (!event.key || ["token", "refreshToken", "userName"].includes(event.key)) sync();
    };
    const preserveOfflineQuran = () => preserveOfflineQuranPreferencesForGuest();
    window.addEventListener(SESSION_ENDING_EVENT, preserveOfflineQuran);
    window.addEventListener(SESSION_UPDATED_EVENT, sync);
    window.addEventListener("storage", storageSync);
    return () => {
      window.removeEventListener(SESSION_ENDING_EVENT, preserveOfflineQuran);
      window.removeEventListener(SESSION_UPDATED_EVENT, sync);
      window.removeEventListener("storage", storageSync);
    };
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem("refreshToken");
    clearStoredSession();
    if (refreshToken) void revokeSession(refreshToken).catch(error => {
      console.warn("Signed out locally, but the server session could not be revoked.",
        error instanceof Error ? error.message : "Network request failed.");
    });
    setToken(null);
    setUserName(null);
    // Prevent Google One Tap from silently signing the user straight back in.
    window.google?.accounts?.id?.disableAutoSelect?.();

    // Broadcast update so views switch to guest settings
    window.dispatchEvent(
      new CustomEvent("ic:settingsUpdated", {
        detail: {
          settings: loadSettings(null),
          userIdentifier: null,
          key: "ic.appSettings_guest",
        },
      })
    );
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    return !!(await refreshSessionToken());
  }, []);

  const user = useMemo<AuthUser | null>(() => {
    if (!token && !userName) return null;
    const email = emailFromToken(token);
    const id = idFromToken(token);
    const resolvedName =
      userName || nameFromToken(token) || (email ? email.split("@")[0] : "Member");
    return {
      id,
      name: resolvedName,
      email,
    };
  }, [userName, token]);

  const userIdentifier = useMemo<string | null>(
    () => user?.email?.toLowerCase() || user?.id || user?.name?.toLowerCase() || null,
    [user]
  );

  const value = useMemo(
    () => ({
      token,
      user,
      userIdentifier,
      login,
      logout,
      refreshSession,
      isAuthenticated: !!token,
    }),
    [token, user, userIdentifier, login, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}