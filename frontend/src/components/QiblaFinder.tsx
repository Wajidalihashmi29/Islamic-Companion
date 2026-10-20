import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, LocateFixed, Navigation } from "lucide-react";
import {
  calculateQiblaBearing,
  calculateRelativeBearing,
  getCompassDirection,
  getSmallestAngleDifference,
  normalizeDegrees,
  unwrapDegrees,
} from "../utils/faithFeatures";

function locationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED)
    return "Location access is blocked. Allow it from your browser's site settings and try again.";
  if (error.code === error.TIMEOUT)
    return "Location detection took too long. Check that location services are enabled and try again.";
  return "We couldn't detect your location. Check location services and try again.";
}

type CompassPermissionEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

type CompassOrientationEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number;
};

type CompassStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";

function getDeviceHeading(event: CompassOrientationEvent): number | null {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading))
    return normalizeDegrees(event.webkitCompassHeading);

  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha) ||
    (!event.absolute && event.type !== "deviceorientationabsolute"))
    return null;

  const screenAngle = window.screen.orientation?.angle ??
    (typeof window.orientation === "number" ? window.orientation : 0);
  return normalizeDegrees(360 - event.alpha + screenAngle);
}

export default function QiblaFinder() {
  const [bearing, setBearing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [compassEnabled, setCompassEnabled] = useState(false);
  const [compassSession, setCompassSession] = useState(0);
  const [compassStatus, setCompassStatus] = useState<CompassStatus>(() =>
    "DeviceOrientationEvent" in window ? "idle" : "unavailable");
  const [heading, setHeading] = useState<number | null>(null);
  const [continuousHeading, setContinuousHeading] = useState(0);
  const headingRef = useRef<number | null>(null);

  useEffect(() => {
    if (!compassEnabled) return;

    let frame = 0;
    let pendingHeading: number | null = null;
    let hasReading = false;
    const noReadingTimer = window.setTimeout(() => {
      if (!hasReading) setCompassStatus("unavailable");
    }, 3000);

    const updateHeading = () => {
      frame = 0;
      if (pendingHeading === null) return;
      const previous = headingRef.current;
      const unwrapped = previous === null ? pendingHeading : unwrapDegrees(previous, pendingHeading);
      headingRef.current = unwrapped;
      setContinuousHeading(unwrapped);
      setHeading(normalizeDegrees(unwrapped));
      setCompassStatus("active");
    };

    const handleOrientation = (rawEvent: Event) => {
      const nextHeading = getDeviceHeading(rawEvent as CompassOrientationEvent);
      if (nextHeading === null) return;
      hasReading = true;
      pendingHeading = nextHeading;
      if (!frame) frame = window.requestAnimationFrame(updateHeading);
    };

    window.addEventListener("deviceorientationabsolute", handleOrientation, true);
    window.addEventListener("deviceorientation", handleOrientation, true);
    return () => {
      window.clearTimeout(noReadingTimer);
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("deviceorientationabsolute", handleOrientation, true);
      window.removeEventListener("deviceorientation", handleOrientation, true);
    };
  }, [compassEnabled, compassSession]);

  const enableCompass = useCallback(async () => {
    setCompassStatus("requesting");
    if (!("DeviceOrientationEvent" in window)) {
      setCompassStatus("unavailable");
      return;
    }

    try {
      const orientationEvent = DeviceOrientationEvent as CompassPermissionEvent;
      if (orientationEvent.requestPermission) {
        const permission = await orientationEvent.requestPermission();
        if (permission !== "granted") {
          setCompassStatus("denied");
          return;
        }
      }
      headingRef.current = null;
      setHeading(null);
      setContinuousHeading(0);
      setCompassEnabled(true);
      setCompassSession(session => session + 1);
    } catch {
      setCompassStatus("denied");
    }
  }, []);

  const resolveLocation = useCallback(() => {
    setError("");
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location detection.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(position => {
      setBearing(calculateQiblaBearing(position.coords.latitude, position.coords.longitude));
      setLoading(false);
    }, geoError => {
      setError(locationError(geoError));
      setLoading(false);
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 300000 });
  }, []);

  const locate = () => {
    if (!compassEnabled) void enableCompass();
    resolveLocation();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      resolveLocation();
      if ("DeviceOrientationEvent" in window) {
        const orientationEvent = DeviceOrientationEvent as CompassPermissionEvent;
        if (!orientationEvent.requestPermission) void enableCompass();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enableCompass, resolveLocation]);

  const relativeBearing = bearing === null
    ? 0
    : heading === null
      ? bearing
      : calculateRelativeBearing(bearing, heading);
  const isAligned = heading !== null && getSmallestAngleDifference(relativeBearing, 0) <= 5;

  return <section className="faith-panel faith-qibla">
    <div className="faith-intro">
      <span className="faith-icon"><Compass /></span>
      <div><h2>Find the Qibla</h2><p>Use your location and phone compass to face the Kaaba in real time.</p></div>
    </div>
    {bearing === null ? <button className="faith-primary" type="button" onClick={locate} disabled={loading}>
      <LocateFixed size={18} />{loading ? "Detecting location..." : "Use my location"}
    </button> : <>
      <div className={`qibla-compass ${compassStatus === "active" ? "is-live" : ""} ${isAligned ? "is-aligned" : ""}`}
        aria-label={`Qibla is ${Math.round(bearing)} degrees ${getCompassDirection(bearing)}`}>
        <div className="qibla-dial" style={{ transform: `rotate(${-continuousHeading}deg)` }} aria-hidden="true">
          <span className="qibla-cardinal qibla-north">N</span>
          <span className="qibla-cardinal qibla-east">E</span>
          <span className="qibla-cardinal qibla-south">S</span>
          <span className="qibla-cardinal qibla-west">W</span>
        </div>
        <div className="qibla-direction" style={{ transform: `rotate(${bearing - continuousHeading}deg)` }} aria-hidden="true">
          <Navigation size={38} fill="currentColor" />
        </div>
        <span className="qibla-kaaba" aria-hidden="true"><span className="qibla-kaaba-door" /></span>
      </div>
      <div className="qibla-readings">
        <p className="qibla-reading"><span>Qibla bearing</span><strong>{Math.round(bearing)}° {getCompassDirection(bearing)}</strong></p>
        <p className="qibla-reading"><span>Phone heading</span><strong>{heading === null ? "—" : `${Math.round(heading)}° ${getCompassDirection(heading)}`}</strong></p>
      </div>
      <p className={`qibla-guidance ${isAligned ? "is-aligned" : ""}`} aria-live="polite">
        <Navigation size={19} />
        <span>{isAligned ? "You are facing the Qibla" : heading === null
          ? "Align N with true north, then follow the Qibla arrow."
          : "Turn your phone until the Qibla arrow points straight up."}</span>
      </p>
      <div className="qibla-actions">
        <button className="faith-secondary" type="button" onClick={locate} disabled={loading}>
          <LocateFixed size={17} />{loading ? "Detecting location..." : "Refresh location"}
        </button>
        {(compassStatus === "idle" || compassStatus === "denied") && <button className="faith-primary" type="button"
          onClick={() => void enableCompass()}>
          <Compass size={17} />Enable live compass
        </button>}
      </div>
      <p className={`qibla-sensor-status is-${compassStatus}`} role="status">
        <span className="qibla-status-dot" />
        {compassStatus === "active" && "Live compass active"}
        {compassStatus === "requesting" && "Waiting for compass permission..."}
        {compassStatus === "denied" && "Compass access was denied. You can still use the calculated bearing."}
        {compassStatus === "unavailable" && "Live compass isn't available on this device. Use the calculated bearing with true north."}
        {compassStatus === "idle" && "Enable the live compass for real-time direction."}
      </p>
    </>}
    {error && <p className="faith-error" role="alert">{error}</p>}
    <p className="faith-note">For best accuracy, move away from metal objects and move your phone in a figure eight to calibrate its compass.</p>
  </section>;
}
