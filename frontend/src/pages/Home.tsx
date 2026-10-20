import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowDown, ArrowRight, BookOpen, Calendar, Clock, Moon } from "lucide-react";
import { features, getFeature, getFeaturePath } from "../config/features";
import { useAuth } from "../context/AuthContext";
import { loadSettings } from "../utils/settingsStorage";
import { formatHijriDate } from "../utils/hijriDate";
import { getInterfaceLocale } from "../i18n/interfaceTranslations";
import TopNav from "../components/TopNav";
import GoldenSpiral from "../components/GoldenSpiral";
import "./Home.css";

export default function Home() {
  const [searchParams] = useSearchParams();
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "active" | "soon">("all");
  const requestedView = searchParams.get("view");

  useEffect(() => {
    // Disable native browser scroll restoration so it doesn't try to scroll down
    // to match a previous page height after a reload resets us to the dashboard.
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  }, []);

  useEffect(() => {
    const legacyFeature = requestedView ? getFeature(requestedView) : undefined;
    if (legacyFeature?.available) navigate(getFeaturePath(legacyFeature.id), { replace: true });
  }, [navigate, requestedView]);

  const [settings, setSettings] = useState(() => loadSettings());

  useEffect(() => {
    const handleSettingsUpdated = () => {
      setSettings(loadSettings());
    };
    window.addEventListener("ic:settingsUpdated", handleSettingsUpdated);
    return () => {
      window.removeEventListener("ic:settingsUpdated", handleSettingsUpdated);
    };
  }, []);

  const { currentDateString, hijriDateString } = useMemo(() => {
    const offset = settings.general.hijriAdjustment || 0;
    const language = settings.general.appLanguage;

    const now = new Date();
    return {
      currentDateString: now.toLocaleDateString(getInterfaceLocale(language), {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      }),
      hijriDateString: formatHijriDate(now, offset, language),
    };
  }, [settings.general.appLanguage, settings.general.hijriAdjustment]);

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
    navigate(getFeaturePath(viewId));
  };

  const renderView = () => {
    return (
      <div className="home-main">
        {/* Welcome hero */}
        <header className="home-hero">
          <GoldenSpiral className="home-hero-spiral" showGrid={false} />

          <div className="home-hero-header-line">
            <span className="home-eyebrow">
              Assalamu Alaikum{user?.name ? `, ${user.name}` : ""}
            </span>
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
          </div>

          <div className="home-hero-content">
            <h1>
              Your Daily <em>Faith Hub</em>
            </h1>
            <p className="home-hero-summary">
              A daily space for Qur'an, prayer, and reflection.
            </p>
            <button type="button" className="home-hero-explore" onClick={scrollToFeatures}>
              Explore features <ArrowDown size={16} aria-hidden="true" />
            </button>
          </div>

          <nav className="home-hero-actions" aria-label="Daily worship">
            <Link className="home-hero-featured home-hero-featured--quran" to="/quran">
              <span className="home-hero-featured-icon" aria-hidden="true"><BookOpen size={22} /></span>
              <span className="home-hero-featured-copy">
                <strong>Read Qur'an</strong>
                <span>Arabic, translations &amp; recitation</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <Link className="home-hero-featured" to="/prayer">
              <span className="home-hero-featured-icon" aria-hidden="true"><Clock size={22} /></span>
              <span className="home-hero-featured-copy">
                <strong>Prayer Times</strong>
                <span>Today's schedule for your location</span>
              </span>
              <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </nav>
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
              ).filter(([, , count]) => count > 0).map(([key, label, count]) => (
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
                    if (available) navigate(getFeaturePath(id));
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
        activeView="dashboard"
        onViewChange={handleNavChange}
        onLogout={handleLogout}
        onSettingsClick={() => navigate("/settings")}
      />

      <main className="home-content">{renderView()}</main>
    </div>
  );
}
