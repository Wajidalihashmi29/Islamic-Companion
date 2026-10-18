import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getTokenExpiryMs } from "../utils/tokenUtils";
import "./SessionExpiryModal.css";

export default function SessionWatcher() {
  const { token, refreshSession, logout } = useAuth();
  const [error, setError] = useState<{ token: string; message: string } | null>(null);

  useEffect(() => {
    if (!token) return;
    let disposed = false;
    let refreshing = false;
    let timer = 0;
    const check = async () => {
      if (disposed || refreshing) return;
      clearTimeout(timer);
      const expiry = getTokenExpiryMs(localStorage.getItem("token") ?? "");
      const delay = expiry ? expiry - Date.now() - 60_000 : 0;
      if (delay > 0) {
        timer = window.setTimeout(check, delay);
        return;
      }
      refreshing = true;
      try {
        const renewed = await refreshSession();
        if (disposed) return;
        setError(null);
        if (!renewed) { logout(); return; }
        const nextExpiry = getTokenExpiryMs(localStorage.getItem("token") ?? "");
        timer = window.setTimeout(check, Math.max(1000, (nextExpiry ?? Date.now()) - Date.now() - 60_000));
      } catch (error) {
        if (!disposed && localStorage.getItem("refreshToken")) {
          console.warn("Session renewal will retry when the connection is restored.",
            error instanceof Error ? error.message : "Network request failed.");
          setError({ token, message: "Your session could not be renewed. Reconnecting automatically…" });
          timer = window.setTimeout(check, 30_000);
        }
      } finally { refreshing = false; }
    };
    const visible = () => { if (document.visibilityState === "visible") void check(); };
    void check();
    window.addEventListener("online", check);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", visible);
    return () => {
      disposed = true; clearTimeout(timer);
      window.removeEventListener("online", check);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [token, refreshSession, logout]);

  return token && token === error?.token ? <p className="session-connection-notice" role="status">{error.message}</p> : null;
}
