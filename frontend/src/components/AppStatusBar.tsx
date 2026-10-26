import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, WifiOff, X } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function AppStatusBar() {
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setDismissed(false);
    };
    const handleOffline = () => {
      setOnline(false);
      setDismissed(false);
    };
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", capture);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", capture);
    };
  }, []);

  const location = useLocation();

  if (dismissed) return null;
  // Never overlay the holy Mushaf on the dedicated PDF page
  if (location.pathname.startsWith("/quran-pdf")) return null;
  if (online && !installPrompt) return null;

  return (
    <aside className={`app-status-bar${online ? "" : " is-offline"}`} role="status">
      {online ? <Download size={17} /> : <WifiOff size={17} />}
      <span>
        {online
          ? "Install Islamic Companion for faster access and offline reading."
          : "You are offline. Downloaded Quran pages and saved content remain available."}
      </span>
      {online && installPrompt && (
        <button
          type="button"
          onClick={async () => {
            await installPrompt.prompt();
            const choice = await installPrompt.userChoice;
            if (choice.outcome === "accepted") setInstallPrompt(null);
          }}
        >
          Install
        </button>
      )}
      <button
        type="button"
        className="app-status-dismiss"
        aria-label="Dismiss status message"
        onClick={() => setDismissed(true)}
      >
        <X size={16} />
      </button>
    </aside>
  );
}
