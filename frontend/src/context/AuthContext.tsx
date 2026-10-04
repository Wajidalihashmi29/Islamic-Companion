import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { refreshTokenRequest } from "../api/authApi";

interface AuthUser {
  name: string;
  email?: string;
}

interface AuthContextType {
  token: string | null;
  user: AuthUser | null;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [userName, setUserName] = useState<string | null>(localStorage.getItem("userName"));

  const login = useCallback((newToken: string, newRefreshToken: string, name?: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("refreshToken", newRefreshToken);
    if (name) {
      localStorage.setItem("userName", name);
      setUserName(name);
    }
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    setToken(null);
    setUserName(null);
    // Prevent Google One Tap from silently signing the user straight back in.
    window.google?.accounts?.id?.disableAutoSelect?.();
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    const storedRefresh = localStorage.getItem("refreshToken");
    if (!storedRefresh) return false;
    try {
      const response = await refreshTokenRequest(storedRefresh);
      localStorage.setItem("token", response.data.token);
      localStorage.setItem("refreshToken", response.data.refreshToken);
      setToken(response.data.token);
      return true;
    } catch {
      return false;
    }
  }, []);

  const user = useMemo<AuthUser | null>(
    () => (userName ? { name: userName, email: emailFromToken(token) } : null),
    [userName, token]
  );

  const value = useMemo(
    () => ({ token, user, login, logout, refreshSession, isAuthenticated: !!token }),
    [token, user, login, logout, refreshSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}