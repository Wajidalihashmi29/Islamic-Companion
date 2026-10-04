import { Hourglass } from "lucide-react";
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
    <div className="modal-overlay">
      <div className="modal-card">
        <div className="icon-tile icon-tile--md" style={{ margin: "0 auto var(--space-3)" }}>
          <Hourglass />
        </div>
        <h3>Your session is ending</h3>
        <p>
          You will be signed out in <strong>{secondsLeft}s</strong> due to inactivity.
        </p>

        <div className="modal-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={onStay}>
            Stay signed in
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={onLogout}>
            Log out now
          </button>
        </div>
      </div>
    </div>
  );
}
