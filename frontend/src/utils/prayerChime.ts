/**
 * Synthesizes a soothing, gentle prayer chime using the Web Audio API.
 * Uses an authentic 4-tone harmonic bell triad (C5 - E5 - G5 - C6) with natural acoustic decay.
 */
let chimeAudioCtx: AudioContext | null = null;

export async function playPrayerChime(volume = 0.22): Promise<void> {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    if (!chimeAudioCtx) chimeAudioCtx = new AudioCtx();
    if (chimeAudioCtx.state === "suspended") {
      await chimeAudioCtx.resume();
    }

    const now = chimeAudioCtx.currentTime;
    const notes = [
      { freq: 523.25, time: 0.0, dur: 1.8 }, // C5
      { freq: 659.25, time: 0.12, dur: 2.0 }, // E5
      { freq: 783.99, time: 0.24, dur: 2.2 }, // G5
      { freq: 1046.50, time: 0.36, dur: 2.5 }, // C6
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
      overtoneGain.gain.linearRampToValueAtTime(volume * 0.22, now + time + 0.03);
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
  } catch (err) {
    console.warn("Unable to play prayer chime audio:", err);
  }
}

if (typeof window !== "undefined") {
  (window as unknown as { playPrayerChime?: typeof playPrayerChime }).playPrayerChime = playPrayerChime;
}
