import { useState } from "react";
import { Play } from "lucide-react";
import { playPrayerChime, unlockPrayerChimeAudio } from "../utils/prayerChime";
import "./ChimeTestButton.css";

interface ChimeTestButtonProps {
  label?: string;
  playingLabel?: string;
  className?: string;
}

export default function ChimeTestButton({
  label = "Test alert chime",
  playingLabel = "Playing chime...",
  className = "",
}: ChimeTestButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    unlockPrayerChimeAudio(); void playPrayerChime(0.6);
    setIsPlaying(true);
    window.setTimeout(() => setIsPlaying(false), 2600);
  };

  return (
    <button
      type="button"
      className={`chime-test-btn ${isPlaying ? "is-playing" : ""} ${className}`}
      onClick={handlePlay}
      aria-label={isPlaying ? "Prayer alert chime playing" : "Test prayer alert chime"}
      title="Listen to prayer alert chime"
    >
      <span className="chime-test-btn-icon" aria-hidden="true">
        {isPlaying ? (
          <span className="chime-equalizer">
            <span className="chime-bar chime-bar-1" />
            <span className="chime-bar chime-bar-2" />
            <span className="chime-bar chime-bar-3" />
          </span>
        ) : (
          <Play size={11} fill="currentColor" style={{ marginLeft: "1.5px" }} />
        )}
      </span>
      <span className="chime-test-btn-label">
        {isPlaying ? playingLabel : label}
      </span>
    </button>
  );
}
