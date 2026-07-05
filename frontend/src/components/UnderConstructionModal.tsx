import { X, Construction } from "lucide-react";
import "./UnderConstructionModal.css";

interface Props {
  featureName: string;
  onClose: () => void;
}

export default function UnderConstructionModal({ featureName, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className="modal-icon">
          <Construction size={28} />
        </div>
        <h3>{featureName}</h3>
        <p>This feature is being built. Check back soon, in shaa Allah.</p>
        <button className="modal-dismiss" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}