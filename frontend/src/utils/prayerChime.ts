/**
 * Synthesizes a soothing, gentle prayer chime using the Web Audio API with HTML5 Audio fallback.
 * Uses an authentic 4-tone harmonic bell triad (C5 - E5 - G5 - C6) with natural acoustic decay.
 */
let chimeAudioCtx: AudioContext | null = null;
let cachedWavUrl: string | null = null;

function getWavChimeUrl(): string {
  if (cachedWavUrl) return cachedWavUrl;
  try {
    const sampleRate = 22050;
    const duration = 2.5;
    const totalSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + totalSamples * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + totalSamples * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, totalSamples * 2, true);

    const notes = [
      { freq: 523.25, start: 0.0, dur: 1.8 }, // C5
      { freq: 659.25, start: 0.12, dur: 2.0 }, // E5
      { freq: 783.99, start: 0.24, dur: 2.2 }, // G5
      { freq: 1046.5, start: 0.36, dur: 2.5 }, // C6
    ];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (const n of notes) {
        if (t >= n.start) {
          const dt = t - n.start;
          const env = Math.exp(-3.2 * dt);
          const tone = Math.sin(2 * Math.PI * n.freq * dt) + 0.25 * Math.sin(4 * Math.PI * n.freq * dt);
          sample += tone * env;
        }
      }
      sample = Math.max(-1, Math.min(1, sample * 0.45));
      view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    const blob = new Blob([buffer], { type: "audio/wav" });
    cachedWavUrl = URL.createObjectURL(blob);
    return cachedWavUrl;
  } catch (err) {
    console.warn("Unable to create WAV fallback blob:", err);
    return "";
  }
}

/**
 * Pre-unlocks audio engine on user interaction (clicks / touches) so alarms can sound
 * even when scheduled asynchronously or in the background.
 */
export function unlockPrayerChimeAudio(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!chimeAudioCtx || chimeAudioCtx.state === "closed") {
      chimeAudioCtx = new AudioCtx();
    }
    if (chimeAudioCtx.state === "suspended") {
      void chimeAudioCtx.resume();
    }
  } catch {}
}

export async function playPrayerChime(volume = 0.5): Promise<void> {
  let playedWebAudio = false;

  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioCtx) {
      if (!chimeAudioCtx || chimeAudioCtx.state === "closed") {
        chimeAudioCtx = new AudioCtx();
      }
      if (chimeAudioCtx.state === "suspended") {
        await chimeAudioCtx.resume();
      }

      if (chimeAudioCtx.state === "running") {
        const now = chimeAudioCtx.currentTime;
        const notes = [
          { freq: 523.25, time: 0.0, dur: 1.8 }, // C5
          { freq: 659.25, time: 0.12, dur: 2.0 }, // E5
          { freq: 783.99, time: 0.24, dur: 2.2 }, // G5
          { freq: 1046.5, time: 0.36, dur: 2.5 }, // C6
        ];

        notes.forEach(({ freq, time, dur }) => {
          if (!chimeAudioCtx) return;
          const osc = chimeAudioCtx.createOscillator();
          const gain = chimeAudioCtx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + time);

          // Subtle warm overtone for tubular bell resonance
          const overtone = chimeAudioCtx.createOscillator();
          const overtoneGain = chimeAudioCtx.createGain();
          overtone.type = "sine";
          overtone.frequency.setValueAtTime(freq * 2, now + time);

          gain.gain.setValueAtTime(0.0001, now + time);
          gain.gain.linearRampToValueAtTime(volume, now + time + 0.035);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          overtoneGain.gain.setValueAtTime(0.0001, now + time);
          overtoneGain.gain.linearRampToValueAtTime(volume * 0.28, now + time + 0.03);
          overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur * 0.6);

          osc.connect(gain);
          gain.connect(chimeAudioCtx.destination);
          overtone.connect(overtoneGain);
          overtoneGain.connect(chimeAudioCtx.destination);

          osc.start(now + time);
          osc.stop(now + time + dur);
          overtone.start(now + time);
          overtone.stop(now + time + dur * 0.6);
        });
        playedWebAudio = true;
      }
    }
  } catch (err) {
    console.warn("Web Audio chime failed, falling back to audio element:", err);
  }

  // If Web Audio API was unavailable or unable to run, use HTML5 Audio fallback
  if (!playedWebAudio) {
    try {
      const url = getWavChimeUrl();
      if (url) {
        const audio = new Audio(url);
        audio.volume = Math.max(0, Math.min(1, volume));
        await audio.play();
      }
    } catch (fallbackErr) {
      console.warn("Unable to play fallback chime audio:", fallbackErr);
    }
  }
}

// Global user gesture listener: unlock audio automatically on user's first touch/click
if (typeof window !== "undefined") {
  (window as unknown as { playPrayerChime?: typeof playPrayerChime }).playPrayerChime = playPrayerChime;

  const handleFirstInteraction = () => {
    unlockPrayerChimeAudio();
    window.removeEventListener("click", handleFirstInteraction);
    window.removeEventListener("touchstart", handleFirstInteraction);
    window.removeEventListener("keydown", handleFirstInteraction);
  };

  window.addEventListener("click", handleFirstInteraction, { passive: true, once: true });
  window.addEventListener("touchstart", handleFirstInteraction, { passive: true, once: true });
  window.addEventListener("keydown", handleFirstInteraction, { passive: true, once: true });
}
