import { useState } from "react";
import { Sunrise, Sun, CloudSun, Sunset, Moon, Star } from "lucide-react";
import LocationSelector from "./LocationSelector";
import type { ResolvedLocation } from "./LocationSelector";
import { getPrayerTimesByCoords, getPrayerTimesByCity } from "../api/prayerTimesApi";
import type { PrayerTimesResponse } from "../api/prayerTimesApi";
import "./PrayerTimesView.css";

const prayerIcons: Record<string, React.ElementType> = {
  Fajr: Star,
  Sunrise: Sunrise,
  Dhuhr: Sun,
  Asr: CloudSun,
  Maghrib: Sunset,
  Isha: Moon,
};

export default function PrayerTimesView() {
  const [data, setData] = useState<PrayerTimesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleResolve = async (location: ResolvedLocation) => {
    setLoading(true);
    setError("");
    try {
      const response =
        location.type === "coords"
          ? await getPrayerTimesByCoords(location.latitude, location.longitude)
          : await getPrayerTimesByCity(location.city, location.country);
      setData(response.data);
    } catch {
      setError("Couldn't fetch prayer times for that location. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ptv-content">
      <div className="ptv-header">
        <p className="ptv-subtitle">Choose how you'd like us to find your prayer times.</p>
      </div>

      <LocationSelector onResolve={handleResolve} loading={loading} />

      {error && <p className="ptv-error">{error}</p>}

      {data && (
        <div className="ptv-result">
          <div className="ptv-result-header">
            <span>{data.date}</span>
            <span className="ptv-hijri">{data.hijriDate} AH</span>
          </div>
          <div className="ptv-grid">
            {Object.entries(data.timings).map(([name, time]) => {
              const Icon = prayerIcons[name] ?? Sun;
              return (
                <div key={name} className="ptv-card">
                  <Icon size={22} className="ptv-icon" />
                  <span className="ptv-name">{name}</span>
                  <span className="ptv-time">{time}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
