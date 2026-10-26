/**
 * Synthesizes a soothing, gentle, warm prayer chime.
 * Engineered specifically for mobile and desktop speakers to prevent clipping,
 * distortion, or speaker buzzing ("fatna") using a Dynamics Compressor,
 * warm acoustic low-pass filter, and soft-saturation limiter.
 */
let chimeAudioCtx: AudioContext | null = null;
let cachedWavUrl: string | null = null;

function getWavChimeUrl(): string {
  if (cachedWavUrl) return cachedWavUrl;
  try {
    const sampleRate = 22050;
    const duration = 2.8;
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

    // Warm, soothing 4-tone triad (C5 - E5 - G5 - C6)
    const notes = [
      { freq: 523.25, start: 0.0, dur: 2.0 }, // C5
      { freq: 659.25, start: 0.15, dur: 2.2 }, // E5
      { freq: 783.99, start: 0.30, dur: 2.4 }, // G5
      { freq: 1046.5, start: 0.45, dur: 2.6 }, // C6
    ];

    for (let i = 0; i < totalSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (const n of notes) {
        if (t >= n.start) {
          const dt = t - n.start;
          // Smooth fade in (0.06s) to eliminate clicks, gentle exponential decay
          const attack = Math.min(1.0, dt / 0.06);
          const env = attack * Math.exp(-2.2 * dt);
          // Pure sine fundamental + very gentle warm overtone
          const tone = Math.sin(2 * Math.PI * n.freq * dt) + 0.12 * Math.sin(4 * Math.PI * n.freq * dt);
          sample += tone * env;
        }
      }
      // Soft-knee saturation limiter to strictly cap peak well under 1.0 (zero distortion)
      sample = Math.tanh(sample * 0.28) * 0.55;
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
 * cleanly even when scheduled asynchronously or in the background.
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

export async function playPrayerChime(): Promise<void> {
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

        // 1. Master Dynamics Compressor: prevents any volume peaks from clipping/distorting the speaker
        const compressor = chimeAudioCtx.createDynamicsCompressor();
        compressor.threshold.setValueAtTime(-14, now);
        compressor.knee.setValueAtTime(12, now);
        compressor.ratio.setValueAtTime(4, now);
        compressor.attack.setValueAtTime(0.005, now);
        compressor.release.setValueAtTime(0.25, now);

        // 2. Warm acoustic Low-Pass Filter: rounds off harsh treble frequencies that cause speaker buzz
        const filter = chimeAudioCtx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(3200, now);

        // 3. Master Gain Node: keeps overall level gentle and pleasing
        const masterGain = chimeAudioCtx.createGain();
        masterGain.gain.setValueAtTime(0.35, now);

        // Chain: filter -> compressor -> masterGain -> destination
        filter.connect(compressor);
        compressor.connect(masterGain);
        masterGain.connect(chimeAudioCtx.destination);

        const notes = [
          { freq: 523.25, time: 0.0, dur: 2.0 }, // C5
          { freq: 659.25, time: 0.15, dur: 2.2 }, // E5
          { freq: 783.99, time: 0.30, dur: 2.4 }, // G5
          { freq: 1046.5, time: 0.45, dur: 2.6 }, // C6
        ];

        notes.forEach(({ freq, time, dur }) => {
          if (!chimeAudioCtx) return;
          const osc = chimeAudioCtx.createOscillator();
          const gain = chimeAudioCtx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + time);

          // Soft fundamental envelope: gentle 0.05s attack, natural exponential decay
          gain.gain.setValueAtTime(0.0001, now + time);
          gain.gain.linearRampToValueAtTime(0.24, now + time + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur);

          // Subtle warm octave overtone (only 12% amplitude for rich tubular bell tone)
          const overtone = chimeAudioCtx.createOscillator();
          const overtoneGain = chimeAudioCtx.createGain();
          overtone.type = "sine";
          overtone.frequency.setValueAtTime(freq * 2, now + time);

          overtoneGain.gain.setValueAtTime(0.0001, now + time);
          overtoneGain.gain.linearRampToValueAtTime(0.035, now + time + 0.04);
          overtoneGain.gain.exponentialRampToValueAtTime(0.0001, now + time + dur * 0.5);

          osc.connect(gain);
          gain.connect(filter);
          overtone.connect(overtoneGain);
          overtoneGain.connect(filter);

          osc.start(now + time);
          osc.stop(now + time + dur);
          overtone.start(now + time);
          overtone.stop(now + time + dur * 0.5);
        });
        playedWebAudio = true;
      }
    }
  } catch (err) {
    console.warn("Web Audio chime failed, falling back to audio element:", err);
  }

  // If Web Audio API was unavailable, use clean WAV fallback
  if (!playedWebAudio) {
    try {
      const url = getWavChimeUrl();
      if (url) {
        const audio = new Audio(url);
        audio.volume = 0.5;
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
