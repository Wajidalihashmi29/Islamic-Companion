import { Construction, X } from "lucide-react";

interface Props {
  featureName: string;
  onClose: () => void;
}

export default function UnderConstructionModal({ featureName, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close dialog">
          <X size={18} />
        </button>

        <div className="icon-tile icon-tile--md" style={{ margin: "0 auto var(--space-3)" }}>
          <Construction />
        </div>

        <h3>{featureName}</h3>
        <p>This feature is currently under active development. Check back soon, In Sha Allah.</p>

        <button type="button" className="btn btn-primary btn-block" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}