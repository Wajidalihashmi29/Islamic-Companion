import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Favorites from "../components/Favorites";
import HadithCollection from "../components/HadithCollection";
import PrayerTimesView from "../components/PrayerTimesView";
import QiblaFinder from "../components/QiblaFinder";
import TopNav from "../components/TopNav";
import ZakatCalculator from "../components/ZakatCalculator";
import DailyAzkar from "../components/DailyAzkar";
import IslamicCalendar from "../components/IslamicCalendar";
import TasbeehCounter from "../components/TasbeehCounter";
import { getFeature, getFeaturePath } from "../config/features";
import { useAuth } from "../context/AuthContext";
import { loadSettings, getStorageKeyForUser } from "../utils/settingsStorage";
import "../components/FaithFeatures.css";
import "./Home.css";

export default function FeaturePage({ featureId }: { featureId: string }) {
  const feature = getFeature(featureId);
  const navigate = useNavigate();
  const { logout, userIdentifier } = useAuth();
  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    const updateSettings = () => setSettings(loadSettings());
    window.addEventListener("ic:settingsUpdated", updateSettings);
    window.scrollTo(0, 0);
    return () => window.removeEventListener("ic:settingsUpdated", updateSettings);
  }, []);

  if (!feature?.available || feature.id === "quran") return <Navigate to="/" replace />;

  const storageKey = getStorageKeyForUser(userIdentifier);
  const featureContent = (() => {
    switch (feature.id) {
      case "prayer": return <PrayerTimesView />;
      case "qibla": return <QiblaFinder />;
      case "hadith": return <HadithCollection language={settings.general.appLanguage} storageKey={storageKey} />;
      case "zakat": return <ZakatCalculator />;
      case "azkar": return <DailyAzkar language={settings.general.appLanguage} />;
      case "calendar": return <IslamicCalendar storageKey={storageKey} />;
      case "tasbeeh": return <TasbeehCounter storageKey={storageKey} />;
      case "favorites": return <Favorites storageKey={storageKey} />;
      default: return null;
    }
  })();

  return (
    <div className="home-page">
      <TopNav
        activeView={feature.id}
        onViewChange={view => navigate(getFeaturePath(view))}
        onLogout={() => {
          logout();
          navigate("/");
        }}
        onSettingsClick={() => navigate("/settings")}
      />
      <main className="home-content">
        <div className="home-view">
          <header className="home-view-header">
            <Link className="home-back-btn" to="/" aria-label="Back to dashboard">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <span className="home-eyebrow">{feature.id === "prayer" ? "Daily Schedule" : feature.shortLabel}</span>
              <h1>{feature.label}</h1>
            </div>
          </header>
          {featureContent}
        </div>
      </main>
    </div>
  );
}
