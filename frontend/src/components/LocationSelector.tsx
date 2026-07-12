import { useState } from "react";
import { LocateFixed, MapPin } from "lucide-react";
import "./LocationSelector.css";

type Mode = "auto" | "manual";

export type ResolvedLocation =
  | { type: "coords"; latitude: number; longitude: number }
  | { type: "city"; city: string; country: string };

interface Props {
  onResolve: (location: ResolvedLocation) => void;
  loading: boolean;
}

export default function LocationSelector({ onResolve, loading }: Props) {
  const [mode, setMode] = useState<Mode>("auto");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [geoError, setGeoError] = useState("");

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === "manual") {
      setGeoError("");
    }
  };

  const handleDetect = () => {
    if (!navigator.geolocation) {
      setGeoError("Your browser doesn't support location detection.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoError("");
        onResolve({
          type: "coords",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        console.error("Geolocation error:", error);
        setGeoError("Location access was denied. Try entering your city manually.");
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !country.trim()) return;
    onResolve({ type: "city", city: city.trim(), country: country.trim() });
  };

  return (
    <div className="loc-selector">
      <div className="loc-tabs">
        <button
          className={`loc-tab ${mode === "auto" ? "active" : ""}`}
          onClick={() => handleModeSwitch("auto")}
          type="button"
        >
          <LocateFixed size={15} /> Automatic
        </button>
        <button
          className={`loc-tab ${mode === "manual" ? "active" : ""}`}
          onClick={() => handleModeSwitch("manual")}
          type="button"
        >
          <MapPin size={15} /> Enter manually
        </button>
      </div>

      {mode === "auto" ? (
        <div className="loc-auto">
          <p>Use your device's location to find accurate prayer times.</p>
          <button className="loc-detect-btn" onClick={handleDetect} disabled={loading}>
            {loading ? "Detecting…" : "Detect my location"}
          </button>
          {geoError && <p className="loc-error">{geoError}</p>}
        </div>
      ) : (
        <form className="loc-manual" onSubmit={handleManualSubmit}>
          <input
            type="text"
            placeholder="City (e.g. Thane)"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Country (e.g. India)"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
          />
          <button type="submit" className="loc-detect-btn" disabled={loading}>
            {loading ? "Loading…" : "Get prayer times"}
          </button>
        </form>
      )}
    </div>
  );
}