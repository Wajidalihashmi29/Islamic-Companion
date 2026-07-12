import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { refreshTokenRequest } from "../api/authApi";

interface AuthContextType {
  token: string | null;
  user: { name: string } | null;
  login: (token: string, refreshToken: string, userName?: string) => void;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<{ name: string } | null>(
    localStorage.getItem("userName") ? { name: localStorage.getItem("userName")! } : null
  );

  const login = (newToken: string, newRefreshToken: string, userName?: string) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("refreshToken", newRefreshToken);
    if (userName) {
      localStorage.setItem("userName", userName);
      setUser({ name: userName });
    }
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("userName");
    setToken(null);
    setUser(null);
  };

  const refreshSession = async (): Promise<boolean> => {
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
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, refreshSession, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}