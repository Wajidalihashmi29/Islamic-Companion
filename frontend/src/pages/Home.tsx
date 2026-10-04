import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowRight, Calendar, Clock, Moon, Sparkles } from "lucide-react";
import { features, getFeature } from "../config/features";
import { useAuth } from "../context/AuthContext";
import TopNav from "../components/TopNav";
import PrayerTimesView from "../components/PrayerTimesView";
import UnderConstructionModal from "../components/UnderConstructionModal";
import GoldenSpiral from "../components/GoldenSpiral";
import "./Home.css";

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard");
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const [currentDateString, setCurrentDateString] = useState("");
  const [hijriDateString, setHijriDateString] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "soon">("all");

  useEffect(() => {
    // Disable native browser scroll restoration so it doesn't try to scroll down
    // to match a previous page height after a reload resets us to the dashboard.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    // Always start at the top when rendering a new view or reloading the page
    window.scrollTo(0, 0);
  }, [activeView]);

  useEffect(() => {
    const now = new Date();
    const formatted = now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    setCurrentDateString(formatted);
    try {
      setHijriDateString(
        new Intl.DateTimeFormat("en-u-ca-islamic", { day: "numeric", month: "long", year: "numeric" }).format(now)
      );
    } catch {
      /* Islamic calendar not supported by this browser — pill is simply hidden */
    }
  }, []);

  const activeCount = features.filter((f) => f.available).length;
  const soonCount = features.length - activeCount;
  const visibleFeatures = features.filter(
    (f) => filter === "all" || (filter === "active" ? f.available : !f.available)
  );

  const scrollToFeatures = () => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("home-features")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleNavChange = (viewId: string) => {
    if (viewId === "dashboard" || viewId === "prayer") {
      setActiveView(viewId);
    } else {
      const feat = getFeature(viewId);
      if (feat) {
        setActiveModal(feat.label);
      }
    }
  };

  const renderView = () => {
    if (activeView === "prayer") {
      return (
        <div className="home-view">
          <header className="home-view-header">
            <button
              className="home-back-btn"
              onClick={() => setActiveView("dashboard")}
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <span className="home-eyebrow">Daily Schedule</span>
              <h1>Prayer Times</h1>
            </div>
          </header>
          <PrayerTimesView />
        </div>
      );
    }

    return (
      <div className="home-main">
        {/* Welcome hero */}
        <header className="home-hero">
          <GoldenSpiral className="home-hero-spiral" showGrid={false} />

          <div className="home-hero-content">
            <div className="home-hero-header-line">
              <span className="home-eyebrow">
                Assalamu Alaikum{user?.name ? `, ${user.name}` : ""}
              </span>              
            </div>
            <div className="home-date-group">
                {currentDateString && (
                  <span className="home-date-pill">
                    <Calendar size={13} aria-hidden="true" />
                    <span>{currentDateString}</span>
                  </span>
                )}
                {hijriDateString && (
                  <span className="home-date-pill home-date-pill--gold">
                    <Moon size={13} aria-hidden="true" />
                    <span>{hijriDateString}</span>
                  </span>
                )}
            </div>
            <h1>
              Your Daily <em>Faith Hub</em>
            </h1>
            <p className="home-hero-quote">
              “Verily, prayer prevents indecency and wrongdoing, and the remembrance of Allah is greater.”
            </p>

            <div className="home-hero-actions">
              <button type="button" className="home-btn home-btn--gold" onClick={() => setActiveView("prayer")}>
                <Clock size={17} aria-hidden="true" /> Today's prayer times
              </button>
              <button type="button" className="home-btn home-btn--glass" onClick={scrollToFeatures}>
                Explore features <ArrowDown size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <button type="button" className="home-hero-featured" onClick={() => setActiveView("prayer")}>
            <span className="home-hero-featured-icon" aria-hidden="true">
              <Clock size={26} />
            </span>
            <span className="home-hero-featured-tag">
              <Sparkles size={13} aria-hidden="true" /> Active feature
            </span>
            <h2>Prayer Times Schedule</h2>
            <p>Find exact prayer timings for your location with auto-detection.</p>
            <span className="home-hero-featured-link">
              View today's schedule <ArrowRight size={16} aria-hidden="true" />
            </span>
          </button>
        </header>

        {/* Feature grid */}
        <section className="home-section" id="home-features" aria-labelledby="home-features-title">
          <div className="home-section-header">
            <div>
              <h2 id="home-features-title">Explore Companions</h2>
              <p>Select a feature to enhance your daily spiritual routine.</p>
            </div>

            <div className="home-filters" role="group" aria-label="Filter features">
              {(
                [
                  ["all", "All", features.length],
                  ["active", "Active", activeCount],
                  ["soon", "Coming soon", soonCount],
                ] as const
              ).map(([key, label, count]) => (
                <button
                  key={key}
                  type="button"
                  className={`home-chip ${filter === key ? "is-on" : ""}`}
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label} <span>{count}</span>
                </button>
              ))}
            </div>
          </div>

          <ul className="home-grid">
            {visibleFeatures.map(({ id, label, description, icon: Icon, available }, i) => (
              <li key={id}>
                <button
                  type="button"
                  className={`home-card ${available ? "is-active" : "is-coming-soon"}`}
                  style={{ "--i": i } as CSSProperties}
                  aria-label={`${label}${available ? "" : " (coming soon)"}`}
                  onClick={() => {
                    if (id === "prayer") {
                      setActiveView("prayer");
                    } else {
                      setActiveModal(label);
                    }
                  }}
                >
                  <div className="home-card-header">
                    <span className="home-card-icon" aria-hidden="true">
                      <Icon />
                    </span>
                    <span className={`home-card-badge ${available ? "home-card-badge--active" : ""}`}>
                      {available ? "Active" : "Coming soon"}
                    </span>
                  </div>

                  <div className="home-card-body">
                    <h3>{label}</h3>
                    <p>{description}</p>
                  </div>

                  <span className="home-card-cta" aria-hidden="true">
                    {available ? "Open" : "Learn more"} <ArrowRight size={15} />
                  </span>
                </button>
              </li>
            ))}
          </ul>

          {visibleFeatures.length === 0 && <p className="home-empty">Nothing here yet.</p>}
        </section>
      </div>
    );
  };

  return (
    <div className="home-page">
      <TopNav
        activeView={activeView}
        onViewChange={handleNavChange}
        onLogout={handleLogout}
        onSettingsClick={() => setActiveModal("Settings")}
      />

      <main className="home-content">{renderView()}</main>

      {activeModal && (
        <UnderConstructionModal
          featureName={activeModal}
          onClose={() => setActiveModal(null)}
        />
      )}
    </div>
  );
}
