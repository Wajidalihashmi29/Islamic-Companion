import { useEffect, useRef, useState } from "react";
import { Globe, LocateFixed, MapPin, Search } from "lucide-react";
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
  const [detecting, setDetecting] = useState(false);
  const requestId = useRef(0);

  // Ignore any geolocation callback that arrives after we unmount
  useEffect(() => {
    return () => {
      requestId.current += 1;
    };
  }, []);

  const busy = loading || detecting;

  const handleModeSwitch = (newMode: Mode) => {
    setMode(newMode);
    if (newMode === "manual") setGeoError("");
  };

  const geoMessage = (err: GeolocationPositionError) => {
    if (err.code === err.PERMISSION_DENIED) {
      return "Location access is blocked for this site. Allow it from the lock icon in your address bar, or enter your city instead.";
    }
    if (err.code === err.TIMEOUT) {
      return "Detecting your location took too long. Please try again, or enter your city instead.";
    }
    return "We couldn't work out your location right now. Make sure location services are on, or enter your city instead.";
  };

  const handleDetect = () => {
    if (busy) return;
    setGeoError("");
    setDetecting(true);
    const id = ++requestId.current;

    if (!navigator.geolocation) {
      setDetecting(false);
      setGeoError("Your browser doesn't support automatic location detection.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (id !== requestId.current) return;
        requestId.current++; // Invalidate so any pending error timeouts are cancelled
        setDetecting(false);
        setGeoError("");
        onResolve({
          type: "coords",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        if (id !== requestId.current) return;
        
        if (error.code === error.PERMISSION_DENIED) {
          setDetecting(false);
          setGeoError(geoMessage(error));
          return;
        }

        const handleChromeBug = async () => {
          try {
            const status = await navigator.permissions.query({ name: "geolocation" });
            if (status.state === "prompt") {
              status.onchange = () => {
                if (status.state === "granted") {
                  handleDetect();
                } else if (status.state === "denied") {
                  setDetecting(false);
                  setGeoError("Location access is blocked for this site.");
                }
              };
              return; 
            }
          } catch {
            // API not supported
          }
          
          // Chrome Bug #2: Chrome may fire an instant error and then a legitimate success 
          // callback several seconds later on the SAME request.
          // We wait 8 seconds to give the late success callback plenty of time to arrive.
          setTimeout(() => {
            if (id === requestId.current) {
              setDetecting(false);
              setGeoError(geoMessage(error));
            }
          }, 8000);
        };

        handleChromeBug();
      },
      { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 }
    );
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !country.trim()) return;
    onResolve({ type: "city", city: city.trim(), country: country.trim() });
  };

  return (
    <div className="loc-card">
      <div className="loc-tabs" role="tablist" aria-label="How to set your location" data-pos={mode === "auto" ? "0" : "1"}>
        <span className="loc-tabs-indicator" aria-hidden="true" />
        <button
          type="button"
          role="tab"
          id="loc-tab-auto"
          aria-selected={mode === "auto"}
          aria-controls="loc-panel"
          className={`loc-tab ${mode === "auto" ? "is-on" : ""}`}
          onClick={() => handleModeSwitch("auto")}
        >
          <LocateFixed size={16} aria-hidden="true" /> Auto detect
        </button>
        <button
          type="button"
          role="tab"
          id="loc-tab-manual"
          aria-selected={mode === "manual"}
          aria-controls="loc-panel"
          className={`loc-tab ${mode === "manual" ? "is-on" : ""}`}
          onClick={() => handleModeSwitch("manual")}
        >
          <MapPin size={16} aria-hidden="true" /> Enter city
        </button>
      </div>

      <div id="loc-panel" role="tabpanel" aria-labelledby={mode === "auto" ? "loc-tab-auto" : "loc-tab-manual"}>
        {mode === "auto" ? (
          <div className="loc-auto">
            <span className="loc-auto-icon" aria-hidden="true">
              <LocateFixed size={26} />
            </span>
            <div className="loc-auto-text">
              <h3>Use my current location</h3>
              <p>We'll use your device location to calculate accurate prayer times. Nothing is stored.</p>
            </div>
            <button type="button" className="loc-btn" onClick={handleDetect} disabled={busy} aria-busy={busy}>
              {busy ? <span className="loc-spinner" aria-hidden="true" /> : <LocateFixed size={17} aria-hidden="true" />}
              {busy ? "Detecting…" : "Detect my location"}
            </button>
          </div>
        ) : (
          <form className="loc-manual" onSubmit={handleManualSubmit}>
            <label className="loc-field">
              <span>City</span>
              <span className="loc-input">
                <MapPin size={17} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="e.g. London"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  autoComplete="address-level2"
                  required
                />
              </span>
            </label>
            <label className="loc-field">
              <span>Country</span>
              <span className="loc-input">
                <Globe size={17} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="e.g. United Kingdom"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  autoComplete="country-name"
                  required
                />
              </span>
            </label>
            <button type="submit" className="loc-btn" disabled={loading}>
              {loading ? <span className="loc-spinner" aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
              {loading ? "Searching…" : "Get prayer times"}
            </button>
          </form>
        )}

        {geoError && (
          <p className="loc-error" role="alert">
            {geoError}
          </p>
        )}
      </div>
    </div>
  );
}
