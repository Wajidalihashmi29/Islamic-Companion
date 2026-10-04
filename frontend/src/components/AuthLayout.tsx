import type { ReactNode } from "react";
import { BookOpen, Clock, Compass, ShieldCheck } from "lucide-react";
import BrandMark from "./BrandMark";
import GoldenSpiral from "./GoldenSpiral";
import "./AuthLayout.css";

const highlights = [
  { icon: Clock, title: "Accurate Prayer Times", text: "Auto-calculated for your location" },
  { icon: BookOpen, title: "Qur'an & Reflection", text: "Read, listen and track your progress" },
  { icon: Compass, title: "Qibla & Mosques", text: "Find your direction anywhere in the world" },
  { icon: ShieldCheck, title: "Private & Secure", text: "Verified credentials & encrypted access" },
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      {/* Full-bleed ambient mesh background */}
      <div className="auth-shell-mesh" aria-hidden="true" />
      <GoldenSpiral className="auth-shell-spiral" showGrid={false} />

      {/* LEFT / TOP: BRAND HERO COPY */}
      <aside className="auth-hero" aria-label="About Islamic Companion">
        <div className="auth-hero-inner">
          <div className="auth-hero-brand">
            <BrandMark size={42} />
            <span>Islamic Companion</span>
          </div>

          <div className="auth-hero-copy">
            <p className="auth-hero-bismillah" lang="ar" dir="rtl">
              بِسْمِ ٱللَّٰهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
            </p>
            <h1>
              Your modern, elegant
              <br />
              <em>Islamic Companion.</em>
            </h1>
            <p className="auth-hero-lead">
              Prayer schedules, Qur'an reading, and daily reflection — beautifully held in one place.
            </p>

            <ul className="auth-hero-highlights">
              {highlights.map(({ icon: Icon, title, text }) => (
                <li key={title}>
                  <span className="auth-hero-icon">
                    <Icon aria-hidden="true" />
                  </span>
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <figure className="auth-hero-quote">
            <blockquote>“Verily, in the remembrance of Allah do hearts find rest.”</blockquote>
            <figcaption>Surah Ar-Ra'd 13:28</figcaption>
          </figure>
        </div>
      </aside>

      {/* RIGHT: TRANSLUCENT FLOATING CARD */}
      <main className="auth-main">
        <div className="auth-main-brand">
          <BrandMark size={36} />
          <span>Islamic Companion</span>
        </div>
        <div className="auth-main-inner">{children}</div>
        <p className="auth-main-footer">© {new Date().getFullYear()} Islamic Companion. All rights reserved.</p>
      </main>
    </div>
  );
}
