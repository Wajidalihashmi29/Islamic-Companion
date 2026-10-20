import { useEffect, useState } from "react";
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
    const update = () => setOnline(navigator.onLine);
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("beforeinstallprompt", capture);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("beforeinstallprompt", capture);
    };
  }, []);

  if (online && (!installPrompt || dismissed)) return null;
  return <aside className={`app-status-bar${online ? "" : " is-offline"}`} role="status">
    {online ? <Download size={17} /> : <WifiOff size={17} />}
    <span>{online ? "Install Islamic Companion for faster access and offline reading." : "You are offline. Downloaded Quran pages and saved content remain available."}</span>
    {online && installPrompt && <button type="button" onClick={async () => {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstallPrompt(null);
    }}>Install</button>}
    {online && <button type="button" className="app-status-dismiss" aria-label="Dismiss install message" onClick={() => setDismissed(true)}><X size={16} /></button>}
  </aside>;
}
