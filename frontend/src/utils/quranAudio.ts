export function getAdjacentQuranVerse(key: string, direction: -1 | 1, surahs: { ayahCount: number }[]): string | null {
  let [surah, ayah] = key.split(":").map(Number);
  ayah += direction;
  if (ayah > surahs[surah - 1].ayahCount) { surah++; ayah = 1; }
  if (ayah < 1) { surah--; ayah = surahs[surah - 1]?.ayahCount ?? 0; }
  return surah < 1 || surah > surahs.length ? null : `${surah}:${ayah}`;
}

export interface RecitationAudio {
  src: string;
  preload: string;
  paused: boolean;
  ended: boolean;
  readyState: number;
  error: { message: string } | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
}

interface AudioSlot {
  element: RecitationAudio;
  key: string | null;
  controller: AbortController | null;
  pending: Promise<void> | null;
}

export interface RecitationState {
  verseKey: string | null;
  playing: boolean;
  loading: boolean;
  error: string;
}

interface RecitationOptions {
  source: (key: string, reciter: string, signal: AbortSignal) => Promise<{ url: string }>;
  next: (key: string) => string | null;
  onState: (state: RecitationState) => void;
  onVerse: (key: string) => void;
}

export class QuranAudioPlayer {
  private slots: AudioSlot[];
  private active = 0;
  private key: string | null = null;
  private reciter = "";
  private wantsPlay = false;
  private revision = 0;
  private disposed = false;
  private listeners: (() => void)[] = [];
  private options: RecitationOptions;

  constructor(elements: [RecitationAudio, RecitationAudio, ...RecitationAudio[]], options: RecitationOptions) {
    this.options = options;
    this.slots = elements.map(element => ({ element, key: null, controller: null, pending: null }));
    this.slots.forEach((slot, index) => {
      const listen = (type: string, callback: () => void) => {
        slot.element.addEventListener(type, callback);
        this.listeners.push(() => slot.element.removeEventListener(type, callback));
      };
      listen("playing", () => {
        if (index === this.active && this.wantsPlay) this.publish(false);
      });
      listen("waiting", () => {
        if (index === this.active && this.wantsPlay) this.publish(true);
      });
      listen("pause", () => {
        if (index === this.active && slot.key && !slot.element.ended && this.wantsPlay) {
          this.wantsPlay = false;
          this.publish(false);
        }
      });
      listen("ended", () => {
        if (index !== this.active || !this.wantsPlay || !this.key) return;
        const next = this.options.next(this.key);
        if (next) this.start(next);
        else this.stop();
      });
      listen("error", () => {
        if (!slot.key || !slot.element.error) return;
        if (index === this.active) this.fail(new Error("The recitation could not be loaded. Please try again or choose another reciter."));
        else {
          console.warn("Unable to buffer the next Ayah.", slot.element.error.message);
          this.release(slot);
        }
      });
    });
  }

  private publish(loading: boolean, error = "") {
    if (!this.disposed) this.options.onState({ verseKey: this.key, playing: this.wantsPlay, loading, error });
  }

  private release(slot: AudioSlot) {
    slot.controller?.abort();
    slot.key = null; slot.controller = null; slot.pending = null;
    slot.element.pause();
    slot.element.removeAttribute("src");
    slot.element.load();
  }

  private prepare(slot: AudioSlot, key: string): Promise<void> {
    if (slot.key === key && slot.pending) return slot.pending;
    this.release(slot);
    const controller = new AbortController();
    slot.key = key; slot.controller = controller;
    slot.pending = this.options.source(key, this.reciter, controller.signal).then(result => {
      controller.signal.throwIfAborted();
      slot.element.preload = "auto";
      slot.element.src = result.url;
      slot.element.load();
    }).catch(error => {
      if (slot.controller === controller) this.release(slot);
      throw error;
    });
    return slot.pending;
  }

  private fail(error: unknown) {
    this.stop();
    this.publish(false, error instanceof Error ? error.message : "Unable to play this recitation.");
  }

  private async playMedia(slot: AudioSlot, revision: number) {
    try { await slot.element.play(); }
    catch (error) {
      if (!this.disposed && revision === this.revision) this.fail(error);
    }
  }

  private preloadNext(key: string, revision: number) {
    const reserved = new Set([this.active]);
    let next: string | null = key;
    for (let i = 1; i < this.slots.length; i++) {
      next = this.options.next(next);
      if (!next) break;
      let index = this.slots.findIndex((slot, index) => !reserved.has(index) && slot.key === next);
      if (index < 0) index = this.slots.findIndex((_slot, index) => !reserved.has(index));
      reserved.add(index);
      void this.prepare(this.slots[index], next).catch(error => {
        if (!this.disposed && revision === this.revision)
          console.warn("Unable to buffer the next Ayah.", error);
      });
    }
  }

  private start(key: string, autoplay = true) {
    const revision = ++this.revision;
    const previous = this.slots[this.active];
    const prepared = this.slots.findIndex(slot => slot.key === key);
    this.active = prepared >= 0 ? prepared : this.key ? (this.active + 1) % this.slots.length : this.active;
    const slot = this.slots[this.active];
    this.key = key; this.wantsPlay = autoplay;
    if (previous !== slot) previous.element.pause();
    const buffered = slot.key === key && slot.element.readyState >= 3;
    // Start buffered media before reader updates can trigger page layout work.
    let playback = autoplay && buffered ? this.playMedia(slot, revision) : null;
    this.publish(autoplay && !buffered);
    this.options.onVerse(key);
    void this.prepare(slot, key).then(async () => {
      if (this.disposed || revision !== this.revision) return;
      if (this.wantsPlay && !playback) playback = this.playMedia(slot, revision);
      this.preloadNext(key, revision);
      if (playback) await playback;
      if (revision === this.revision) this.publish(false);
    }).catch(error => {
      if (!this.disposed && revision === this.revision) this.fail(error);
    });
  }

  toggle(key: string) {
    if (key === this.key && this.wantsPlay) {
      this.wantsPlay = false;
      this.slots[this.active].element.pause();
      this.publish(false);
    } else this.start(key);
  }

  play(key: string) { this.start(key); }

  setReciter(reciter: string) {
    if (this.reciter === reciter) return;
    const key = this.key, playing = this.wantsPlay;
    this.reciter = reciter;
    this.revision++;
    this.slots.forEach(slot => this.release(slot));
    if (key) this.start(key, playing);
  }

  stop() {
    this.revision++;
    this.wantsPlay = false; this.key = null;
    this.slots.forEach(slot => this.release(slot));
    this.publish(false);
  }

  dispose() {
    this.disposed = true;
    this.listeners.forEach(remove => remove());
    this.stop();
  }
}
