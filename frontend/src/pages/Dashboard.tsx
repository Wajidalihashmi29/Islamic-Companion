import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, Compass, BookOpen, ScrollText, Calculator,
  CalendarCheck, MapPin, Heart, Settings, LogOut, Moon,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import UnderConstructionModal from "../components/UnderConstructionModal";
import "./Dashboard.css";

const features = [
  { id: "prayer", label: "Prayer Times", desc: "Today's five prayers, based on your location", icon: Clock },
  { id: "qibla", label: "Qibla Finder", desc: "Direction to the Kaaba from wherever you are", icon: Compass },
  { id: "quran", label: "Qur'an Reader", desc: "Read with translation and audio recitation", icon: BookOpen },
  { id: "hadith", label: "Hadith Collection", desc: "Browse authentic hadith by book and chapter", icon: ScrollText },
  { id: "zakat", label: "Zakat Calculator", desc: "Work out what you owe this year", icon: Calculator },
  { id: "fasting", label: "Fasting Tracker", desc: "Log your fasts and keep your streak", icon: CalendarCheck },
  { id: "mosque", label: "Mosque Finder", desc: "Nearby mosques and prayer halls", icon: MapPin },
  { id: "favorites", label: "Favorites", desc: "Verses, duas, and hadith you've saved", icon: Heart },
];

export default function Dashboard() {
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const openModal = (label: string) => setActiveModal(label);

  return (
    <div className="dash-page">
      <aside className="dash-sidebar">
        <div className="dash-logo">
          <Moon size={22} />
          <span>Islamic Companion</span>
        </div>

        <nav className="dash-nav">
          {features.map(({ id, label, icon: Icon }) => (
            <button key={id} className="dash-nav-item" onClick={() => openModal(label)}>
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <button className="dash-nav-item" onClick={() => openModal("Settings")}>
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="dash-nav-item dash-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="dash-main">
        <header className="dash-header">
          <div>
            <p className="dash-eyebrow">Assalamu Alaikum</p>
            <h1>Your dashboard</h1>
          </div>
        </header>

        <section className="dash-grid">
          {features.map(({ id, label, desc, icon: Icon }) => (
            <button key={id} className="dash-card" onClick={() => openModal(label)}>
              <div className="dash-card-icon">
                <Icon size={22} />
              </div>
              <h3>{label}</h3>
              <p>{desc}</p>
            </button>
          ))}
        </section>
      </main>

      {activeModal && (
        <UnderConstructionModal featureName={activeModal} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}