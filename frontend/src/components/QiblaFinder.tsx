import { useCallback, useEffect, useRef, useState } from "react";
import { Compass, LocateFixed, Navigation } from "lucide-react";
import {
  calculateQiblaBearing,
  calculateRelativeBearing,
  getCompassDirection,
  getSmallestAngleDifference,
  normalizeDegrees,
  smoothCompassHeading,
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
  webkitCompassAccuracy?: number;
};

type CompassStatus = "idle" | "requesting" | "active" | "denied" | "unavailable";

function getDeviceHeading(event: CompassOrientationEvent) {
  if (typeof event.webkitCompassHeading === "number" && Number.isFinite(event.webkitCompassHeading)) {
    const accuracy = typeof event.webkitCompassAccuracy === "number" &&
      Number.isFinite(event.webkitCompassAccuracy) && event.webkitCompassAccuracy >= 0
      ? event.webkitCompassAccuracy
      : null;
    return { heading: normalizeDegrees(event.webkitCompassHeading), accuracy, preferred: true };
  }

  if (typeof event.alpha !== "number" || !Number.isFinite(event.alpha) ||
    (!event.absolute && event.type !== "deviceorientationabsolute"))
    return null;

  const screenAngle = window.screen.orientation?.angle ??
    (typeof window.orientation === "number" ? window.orientation : 0);
  return { heading: normalizeDegrees(360 - event.alpha + screenAngle), accuracy: null, preferred: false };
}

let compassAudioCtx: AudioContext | null = null;
function playCompassTick() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!compassAudioCtx) compassAudioCtx = new AudioCtx();
    if (compassAudioCtx.state === "suspended") {
      void compassAudioCtx.resume();
    }
    const osc = compassAudioCtx.createOscillator();
    const gain = compassAudioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1400, compassAudioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, compassAudioCtx.currentTime + 0.012);
    gain.gain.setValueAtTime(0.045, compassAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, compassAudioCtx.currentTime + 0.012);
    osc.connect(gain);
    gain.connect(compassAudioCtx.destination);
    osc.start();
    osc.stop(compassAudioCtx.currentTime + 0.012);
  } catch {}
}

export default function QiblaFinder() {
  const orientationEvent = "DeviceOrientationEvent" in window
    ? DeviceOrientationEvent as CompassPermissionEvent
    : null;
  const canStartWithoutGesture = orientationEvent !== null && !orientationEvent.requestPermission;
  const [bearing, setBearing] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [compassEnabled, setCompassEnabled] = useState(canStartWithoutGesture);
  const [compassSession, setCompassSession] = useState(0);
  const [compassStatus, setCompassStatus] = useState<CompassStatus>(() =>
    orientationEvent === null ? "unavailable" : canStartWithoutGesture ? "requesting" : "idle");
  const [heading, setHeading] = useState<number | null>(null);
  const [headingAccuracy, setHeadingAccuracy] = useState<number | null>(null);
  const [continuousHeading, setContinuousHeading] = useState(0);
  const headingRef = useRef<number | null>(null);
  const locationWatch = useRef<number | null>(null);

  useEffect(() => {
    if (!compassEnabled) return;

    let frame = 0;
    let pendingReading: ReturnType<typeof getDeviceHeading> = null;
    let hasReading = false;
    let preferWebkitUntil = 0;
    const noReadingTimer = window.setTimeout(() => {
      if (!hasReading) setCompassStatus("unavailable");
    }, 3000);

    const updateHeading = () => {
      frame = 0;
      if (pendingReading === null) return;
      const smoothed = smoothCompassHeading(headingRef.current, pendingReading.heading);
      headingRef.current = smoothed;
      setContinuousHeading(smoothed);
      setHeading(normalizeDegrees(smoothed));
      setHeadingAccuracy(pendingReading.accuracy);
      setCompassStatus("active");
    };

    const handleOrientation = (rawEvent: Event) => {
      const reading = getDeviceHeading(rawEvent as CompassOrientationEvent);
      if (reading === null) return;
      const now = performance.now();
      if (reading.preferred) preferWebkitUntil = now + 1000;
      else if (now < preferWebkitUntil) return;
      hasReading = true;
      pendingReading = reading;
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

  const enableCompass = useCallback(async (automatic = false) => {
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
      setHeadingAccuracy(null);
      setContinuousHeading(0);
      setCompassEnabled(true);
      setCompassSession(session => session + 1);
    } catch {
      setCompassStatus(automatic ? "idle" : "denied");
    }
  }, []);

  const resolveLocation = useCallback(() => {
    setError("");
    if (!navigator.geolocation) {
      setError("Your browser doesn't support location detection.");
      return;
    }
    if (locationWatch.current !== null) navigator.geolocation.clearWatch(locationWatch.current);
    setLoading(true);
    locationWatch.current = navigator.geolocation.watchPosition(position => {
      setBearing(calculateQiblaBearing(position.coords.latitude, position.coords.longitude));
      setLoading(false);
    }, geoError => {
      setError(locationError(geoError));
      setLoading(false);
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }, []);

  const locate = () => {
    if (!compassEnabled) void enableCompass();
    resolveLocation();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      resolveLocation();
      if ("DeviceOrientationEvent" in window) void enableCompass(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [enableCompass, resolveLocation]);

  useEffect(() => () => {
    if (locationWatch.current !== null) navigator.geolocation.clearWatch(locationWatch.current);
  }, []);

  const relativeBearing = bearing === null
    ? 0
    : heading === null
      ? bearing
      : calculateRelativeBearing(bearing, heading);
  const compassNeedsCalibration = headingAccuracy !== null && headingAccuracy > 15;
  const isAligned = heading !== null && !compassNeedsCalibration &&
    getSmallestAngleDifference(relativeBearing, 0) <= 3;

  const lastTickHeading = useRef<number>(0);
  useEffect(() => {
    if (heading !== null && Math.abs(continuousHeading - lastTickHeading.current) >= 3.5) {
      playCompassTick();
      lastTickHeading.current = continuousHeading;
    }
  }, [continuousHeading, heading]);

  const wasAlignedRef = useRef(false);
  useEffect(() => {
    if (isAligned && !wasAlignedRef.current) {
      if ("vibrate" in navigator) {
        try {
          navigator.vibrate([60, 40, 60]);
        } catch {}
      }
    }
    wasAlignedRef.current = isAligned;
  }, [isAligned]);

  return <section className="faith-panel faith-qibla">
    <div className="faith-intro">
      <span className="faith-icon"><Compass /></span>
      <div><h2>Find the Qibla</h2></div>
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
        <div className={`qibla-direction ${isAligned ? "is-aligned" : ""}`} style={{ transform: `rotate(${bearing - continuousHeading}deg)` }} aria-hidden="true">
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
        {compassStatus === "active" && (compassNeedsCalibration
          ? "Live compass needs calibration. Move your phone in a figure eight."
          : "Live compass active and tracking movement")}
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
