import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getTokenExpiryMs } from "../utils/tokenUtils";
import SessionExpiryModal from "./SessionExpiryModal";

const WARNING_BEFORE_MS = 20_000; // Show modal 20s before expiry

export default function SessionWatcher() {
  const { token, refreshSession, logout, isAuthenticated } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const warningTimerRef = useRef<number | null>(null);
  const navigate = useNavigate();

  // Schedule warning whenever token changes
  useEffect(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    setShowModal(false);

    if (!isAuthenticated || !token) {
      return;
    }

    const expiry = getTokenExpiryMs(token);

    if (!expiry) {
      return;
    }

    const delay = Math.max(
      expiry - WARNING_BEFORE_MS - Date.now(),
      0
    );

    warningTimerRef.current = window.setTimeout(() => {
      setShowModal(true);
    }, delay);

    return () => {
      if (warningTimerRef.current) {
        clearTimeout(warningTimerRef.current);
      }
    };
  }, [token, isAuthenticated]);

  // Countdown
  useEffect(() => {
    if (!showModal || !token) return;

    const expiry = getTokenExpiryMs(token);

    if (!expiry) return;

    const updateCountdown = () => {
      const secs = Math.max(
        Math.ceil((expiry - Date.now()) / 1000),
        0
      );

      setSecondsLeft(secs);

      if (secs <= 0) {
        setShowModal(false);
        logout();
        navigate("/");
      }
    };

    updateCountdown();

    const interval = window.setInterval(
      updateCountdown,
      1000
    );

    return () => clearInterval(interval);
  }, [showModal, token, logout, navigate]);

  const handleStay = async () => {
    setShowModal(false);

    const success = await refreshSession();

    if (!success) {
      logout();
      navigate("/");
    }
  };

  const handleLogout = () => {
    setShowModal(false);
    logout();
    navigate("/");
  };

  if (!showModal) {
    return null;
  }

  return (
    <SessionExpiryModal
      secondsLeft={secondsLeft}
      onStay={handleStay}
      onLogout={handleLogout}
    />
  );
}
