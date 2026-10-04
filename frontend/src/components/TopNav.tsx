import { useState, useRef, useEffect } from "react";
import { LogOut, Menu, Settings, X, Ellipsis } from "lucide-react";
import BrandMark from "./BrandMark";
import { dashboardItem, features } from "../config/features";
import { useAuth } from "../context/AuthContext";
import "./TopNav.css";

interface TopNavProps {
  activeView: string;
  onViewChange: (view: string) => void;
  onLogout: () => void;
  onSettingsClick: () => void;
}

export default function TopNav({
  activeView,
  onViewChange,
  onLogout,
  onSettingsClick,
}: TopNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    }
    if (moreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [moreMenuOpen]);

  const primaryItems = [dashboardItem, ...features.filter((f) => f.primary)];
  const secondaryItems = features.filter((f) => !f.primary);

  const handleNavClick = (id: string) => {
    onViewChange(id);
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  };

  const isSecondaryActive = secondaryItems.some((item) => item.id === activeView);

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <nav className="top-nav">
      <div className="top-nav-container">
        {/* Brand logo */}
        <button
          className="top-nav-logo"
          onClick={() => handleNavClick("dashboard")}
          type="button"
        >
          <BrandMark size={36} />
          <div className="top-nav-brand-text">
            <span className="top-nav-title">Islamic Companion</span>
            <span className="top-nav-subtitle">Daily Faith Portal</span>
          </div>
        </button>

        {/* Desktop Navigation */}
        <div className="top-nav-desktop">
          <div className="top-nav-links" role="tablist">
            {primaryItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={activeView === id}
                className={`top-nav-link ${activeView === id ? "active" : ""}`}
                onClick={() => handleNavClick(id)}
              >
                <Icon className="top-nav-link-icon" />
                <span>{label}</span>
              </button>
            ))}

            {/* More dropdown */}
            {secondaryItems.length > 0 && (
              <div className="top-nav-dropdown-wrapper" ref={dropdownRef}>
                <button
                  type="button"
                  className={`top-nav-link ${isSecondaryActive ? "active" : ""}`}
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  aria-expanded={moreMenuOpen}
                >
                  <Ellipsis className="top-nav-link-icon" />
                  <span>More</span>
                </button>

                {moreMenuOpen && (
                  <div className="top-nav-dropdown">
                    {secondaryItems.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        className={`top-nav-dropdown-item ${activeView === id ? "active" : ""}`}
                        onClick={() => handleNavClick(id)}
                      >
                        <Icon size={16} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="top-nav-actions">
            {/* User Profile Badge */}
            <div className="top-nav-user-badge" title={user?.name || "User Profile"}>
              <span className="top-nav-avatar">{userInitial}</span>
              <span className="top-nav-user-name">{user?.name || "Member"}</span>
            </div>

            <button
              className="top-nav-icon-btn"
              onClick={onSettingsClick}
              title="Settings"
              aria-label="Settings"
            >
              <Settings size={18} />
            </button>
            <button
              className="top-nav-icon-btn logout"
              onClick={onLogout}
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Toggle */}
        <button
          className="top-nav-mobile-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Menu Drawer */}
      {mobileMenuOpen && (
        <div className="top-nav-mobile">
          <div className="top-nav-mobile-header">
            <div className="top-nav-user-badge">
              <span className="top-nav-avatar">{userInitial}</span>
              <div className="top-nav-user-info">
                <strong>{user?.name || "Member"}</strong>
                <small>{user?.email || "Account Active"}</small>
              </div>
            </div>
          </div>

          <div className="top-nav-mobile-links">
            <button
              className={`top-nav-mobile-link ${activeView === "dashboard" ? "active" : ""}`}
              onClick={() => handleNavClick("dashboard")}
            >
              <dashboardItem.icon size={18} />
              <span>Dashboard</span>
            </button>

            <div className="top-nav-mobile-section">Features</div>

            {features.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`top-nav-mobile-link ${activeView === id ? "active" : ""}`}
                onClick={() => handleNavClick(id)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}

            <hr className="top-nav-mobile-divider" />

            <button
              className="top-nav-mobile-link"
              onClick={() => {
                onSettingsClick();
                setMobileMenuOpen(false);
              }}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>

            <button
              className="top-nav-mobile-link logout"
              onClick={() => {
                onLogout();
                setMobileMenuOpen(false);
              }}
            >
              <LogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
