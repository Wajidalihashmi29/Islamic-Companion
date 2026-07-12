import { useState } from "react";
import { Menu, X, Moon, Settings, LogOut } from "lucide-react";
import "./TopNav.css";

interface TopNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  onSettingsClick: () => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard" },
  { id: "prayer", label: "Prayer Times" },
  { id: "qibla", label: "Qibla Finder" },
  { id: "quran", label: "Qur'an Reader" },
  { id: "hadith", label: "Hadith Collection" },
  { id: "zakat", label: "Zakat Calculator" },
  { id: "fasting", label: "Fasting Tracker" },
  { id: "mosque", label: "Mosque Finder" },
  { id: "favorites", label: "Favorites" },
];

export default function TopNav({ activeView, onViewChange, onLogout, onSettingsClick }: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleNavClick = (id: string) => {
    onViewChange(id);
    closeMobileMenu();
  };

  return (
    <nav className="top-nav">
      <div className="top-nav-container">
        <div className="top-nav-logo">
          <Moon size={20} />
          <span>Islamic Companion</span>
        </div>

        {/* Desktop Navigation */}
        <div className="top-nav-desktop">
          <div className="top-nav-links">
            {navItems.map(({ id, label }) => (
              <button
                key={id}
                className={`top-nav-link ${activeView === id ? "active" : ""}`}
                onClick={() => handleNavClick(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="top-nav-actions">
            <button className="top-nav-icon-btn" onClick={onSettingsClick} title="Settings">
              <Settings size={18} />
            </button>
            <button className="top-nav-icon-btn logout" onClick={onLogout} title="Logout">
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Menu Button */}
        <button
          className="top-nav-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="top-nav-mobile">
          <div className="top-nav-mobile-links">
            {navItems.map(({ id, label }) => (
              <button
                key={id}
                className={`top-nav-mobile-link ${activeView === id ? "active" : ""}`}
                onClick={() => handleNavClick(id)}
              >
                {label}
              </button>
            ))}
            <hr className="top-nav-mobile-divider" />
            <button className="top-nav-mobile-link settings" onClick={() => {
              onSettingsClick();
              closeMobileMenu();
            }}>
              <Settings size={16} />
              Settings
            </button>
            <button className="top-nav-mobile-link logout" onClick={() => {
              onLogout();
              closeMobileMenu();
            }}>
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
