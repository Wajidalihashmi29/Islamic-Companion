import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  Clock, Compass, BookOpen, ScrollText, Calculator,
  CalendarCheck, MapPin, Heart,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import TopNav from "../components/TopNav";
import PrayerTimesView from "../components/PrayerTimesView";
import UnderConstructionModal from "../components/UnderConstructionModal";
import "./Home.css";

const features = [
  { id: "prayer", label: "Prayer Times", viewName: "Prayer Times", icon: Clock },
  { id: "qibla", label: "Qibla Finder", viewName: "Qibla Finder", icon: Compass },
  { id: "quran", label: "Qur'an Reader", viewName: "Qur'an Reader", icon: BookOpen },
  { id: "hadith", label: "Hadith Collection", viewName: "Hadith Collection", icon: ScrollText },
  { id: "zakat", label: "Zakat Calculator", viewName: "Zakat Calculator", icon: Calculator },
  { id: "fasting", label: "Fasting Tracker", viewName: "Fasting Tracker", icon: CalendarCheck },
  { id: "mosque", label: "Mosque Finder", viewName: "Mosque Finder", icon: MapPin },
  { id: "favorites", label: "Favorites", viewName: "Favorites", icon: Heart },
];

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleNavChange = (viewId: string) => {
    if (viewId === "dashboard") {
      setActiveView("dashboard");
    } else if (viewId === "prayer") {
      setActiveView("prayer");
    } else {
      // Show modal for under-construction features
      const feature = features.find(f => f.id === viewId);
      if (feature) {
        setActiveModal(feature.viewName);
      }
    }
  };

  const renderView = () => {
    switch (activeView) {
      case "prayer":
        return (
          <div className="home-view">
            <div className="home-view-header">
              <button 
                className="home-back-btn" 
                onClick={() => setActiveView("dashboard")}
              >
                <ArrowLeft size={20} />
              </button>
              <h1>Prayer Times</h1>
            </div>
            <PrayerTimesView />
          </div>
        );
      case "dashboard":
      default:
        return (
          <div className="home-main">
            <header className="home-header">
              <div>
                <p className="home-eyebrow">
                  Assalamu Alaikum{user?.name && `, ${user.name}`}
                </p>
                <h1>Your dashboard</h1>
              </div>
            </header>

            <section className="home-grid">
              {features.map(({ id, label, icon: Icon }) => {
                if (!Icon) return null;
                return (
                  <button
                    key={id}
                    className="home-card"
                    onClick={() => {
                      if (id === "prayer") {
                        setActiveView("prayer");
                      } else {
                        setActiveModal(label);
                      }
                    }}
                  >
                    <div className="home-card-icon">
                      <Icon size={22} />
                    </div>
                    <h3>{label}</h3>
                    <p>
                      {id === "prayer" && "Today's five prayers, based on your location"}
                      {id === "qibla" && "Direction to the Kaaba from wherever you are"}
                      {id === "quran" && "Read with translation and audio recitation"}
                      {id === "hadith" && "Browse authentic hadith by book and chapter"}
                      {id === "zakat" && "Work out what you owe this year"}
                      {id === "fasting" && "Log your fasts and keep your streak"}
                      {id === "mosque" && "Nearby mosques and prayer halls"}
                      {id === "favorites" && "Verses, duas, and hadith you've saved"}
                    </p>
                  </button>
                );
              })}
            </section>
          </div>
        );
    }
  };

  return (
    <div className="home-page">
      <TopNav
        activeView={activeView}
        onViewChange={handleNavChange}
        onLogout={handleLogout}
        onSettingsClick={() => setActiveModal("Settings")}
      />

      <main className="home-content">
        {renderView()}
      </main>

      {activeModal && (
        <UnderConstructionModal featureName={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}
