import "./SessionExpiryModal.css";

interface Props {
  secondsLeft: number;
  onStay: () => void;
  onLogout: () => void;
}

export default function SessionExpiryModal({
  secondsLeft,
  onStay,
  onLogout,
}: Props) {
  return (
    <div className="session-overlay">
      <div className="session-card">
        <h3>Your session is ending</h3>

        <p>
          You'll be signed out in{" "}<strong>{secondsLeft}s</strong> due to inactivity.
        </p>

        <div className="session-actions">
          <button
            className="session-stay"
            onClick={onStay}
          >
            Stay signed in
          </button>

          <button
            className="session-logout"
            onClick={onLogout}
          >
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}
