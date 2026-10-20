import assert from "node:assert/strict";
import test from "node:test";
import { getAdjacentQuranVerse, QuranAudioPlayer } from "../src/utils/quranAudio.ts";
import type { RecitationAudio, RecitationState } from "../src/utils/quranAudio.ts";

class FakeAudio extends EventTarget implements RecitationAudio {
  src = "";
  preload = "";
  paused = true;
  ended = false;
  readyState = 0;
  error: { message: string } | null = null;
  plays = 0;
  async play() {
    this.paused = false; this.ended = false; this.plays++;
    this.dispatchEvent(new Event("playing"));
  }
  pause() {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  }
  load() { this.readyState = this.src ? 4 : 0; this.ended = false; }
  removeAttribute(name: string) { if (name === "src") this.src = ""; }
  finish() {
    this.paused = true; this.ended = true;
    this.dispatchEvent(new Event("ended"));
  }
}

const settle = () => new Promise<void>(resolve => setImmediate(resolve));
const next = (key: string) => getAdjacentQuranVerse(key, 1, [{ ayahCount: 7 }, { ayahCount: 286 }]);

test("continuous recitation prepares the next media element before the current Ayah ends", async () => {
  const a = new FakeAudio(), b = new FakeAudio(), requests: string[] = [], states: RecitationState[] = [];
  const player = new QuranAudioPlayer([a, b], {
    source: async key => { requests.push(key); return { url: key }; },
    next, onState: state => states.push(state), onVerse: () => {},
  });
  try {
    player.setReciter("alafasy"); player.play("1:7"); await settle();
    assert.deepEqual(requests, ["1:7", "2:1"]);
    assert.equal(a.plays, 1); assert.equal(b.plays, 0);
    assert.equal(b.src, "2:1"); assert.equal(b.preload, "auto");
    states.length = 0;
    a.finish(); await settle();
    assert.equal(b.plays, 1);
    assert.equal(requests.filter(key => key === "2:1").length, 1);
    assert(states.every(state => state.playing && !state.loading));
    assert.equal(states.at(-1)?.verseKey, "2:1");
    assert.equal(a.src, "2:2");
  } finally { player.dispose(); }
});

test("two upcoming Ayahs stay buffered and handoff starts playback before reader layout callbacks", async () => {
  const elements = [new FakeAudio(), new FakeAudio(), new FakeAudio()] as const;
  const requests: string[] = [];
  const player = new QuranAudioPlayer([...elements], {
    source: async key => { requests.push(key); return { url: key }; },
    next, onState: () => {},
    onVerse: key => {
      if (key === "2:1" || key === "2:2")
        assert(elements.some(element => element.src === key && !element.paused),
          "Buffered playback must start before page-follow work.");
    },
  });
  try {
    player.play("1:7"); await settle();
    assert.deepEqual(requests, ["1:7", "2:1", "2:2"]);
    elements[0].finish();
    assert.equal(elements[1].plays, 1, "The ended event must not wait for a promise or UI update.");
    await settle();
    assert.equal(elements[0].src, "2:3");
    elements[1].finish();
    assert.equal(elements[2].plays, 1);
    await settle();
    assert.deepEqual(requests, ["1:7", "2:1", "2:2", "2:3", "2:4"]);
  } finally { player.dispose(); }
});

test("changing reciter while paused replaces both lookahead buffers without restarting playback", async () => {
  const elements = [new FakeAudio(), new FakeAudio(), new FakeAudio()] as const;
  const player = new QuranAudioPlayer([...elements], {
    source: async (key, reciter) => ({ url: `${reciter}/${key}` }),
    next, onState: () => {}, onVerse: () => {},
  });
  try {
    player.setReciter("alafasy"); player.play("1:1"); await settle();
    player.toggle("1:1"); player.setReciter("husary"); await settle();
    assert(elements.every(element => element.paused && element.src.startsWith("husary/")));
    assert.equal(elements.reduce((total, element) => total + element.plays, 0), 1);
    player.toggle("1:1"); await settle();
    assert.equal(elements.reduce((total, element) => total + element.plays, 0), 2);
  } finally { player.dispose(); }
});

test("cancelling a buffered handoff handles its rejected play promise without restoring playback or showing an obsolete error", async () => {
  class PendingAudio extends FakeAudio {
    rejectPlay: ((error: Error) => void) | undefined;
    override play() {
      this.paused = false;
      return new Promise<void>((_resolve, reject) => { this.rejectPlay = reject; });
    }
  }
  const a = new FakeAudio(), b = new PendingAudio(), states: RecitationState[] = [];
  const player = new QuranAudioPlayer([a, b], {
    source: async key => ({ url: key }), next,
    onState: state => states.push(state), onVerse: () => {},
  });
  try {
    player.play("1:1"); await settle();
    a.finish(); player.stop();
    b.rejectPlay!(new Error("Playback was interrupted."));
    await settle();
    assert.equal(states.at(-1)?.verseKey, null);
    assert.equal(states.at(-1)?.playing, false);
    assert.equal(states.at(-1)?.error, "");
  } finally { player.dispose(); }
});

test("pausing while a source is pending does not start it later, and resume reuses that source", async () => {
  const a = new FakeAudio(), b = new FakeAudio(), states: RecitationState[] = [];
  let resolve: ((value: { url: string }) => void) | undefined;
  let requests = 0;
  const player = new QuranAudioPlayer([a, b], {
    source: () => { requests++; return new Promise(done => { resolve = done; }); },
    next: () => null, onState: state => states.push(state), onVerse: () => {},
  });
  try {
    player.play("1:1"); player.toggle("1:1");
    resolve!({ url: "first" }); await settle();
    assert.equal(a.plays + b.plays, 0);
    assert.equal(states.at(-1)?.playing, false);
    player.toggle("1:1"); await settle();
    assert.equal(a.plays + b.plays, 1); assert.equal(requests, 1);
    a.pause();
    assert.equal(states.at(-1)?.playing, false, "External media pauses must be reflected in the controls.");
  } finally { player.dispose(); }
});

test("changing reciter discards old buffers without resuming a paused recitation", async () => {
  const a = new FakeAudio(), b = new FakeAudio(), requests: string[] = [], states: RecitationState[] = [];
  const player = new QuranAudioPlayer([a, b], {
    source: async (key, reciter) => { requests.push(`${reciter}:${key}`); return { url: `${reciter}/${key}` }; },
    next, onState: state => states.push(state), onVerse: () => {},
  });
  try {
    player.setReciter("alafasy"); player.play("1:1"); await settle();
    player.toggle("1:1"); player.setReciter("husary"); await settle();
    assert.equal(a.plays + b.plays, 1);
    assert(requests.includes("husary:1:1")); assert(requests.includes("husary:1:2"));
    assert.equal(states.at(-1)?.playing, false);
    player.toggle("1:1"); await settle();
    assert.equal(a.plays + b.plays, 2);
    assert([a, b].some(audio => !audio.paused && audio.src === "husary/1:1"));
  } finally { player.dispose(); }
});

test("a failed next-Ayah preload leaves current audio playing and is retried with an explicit error on advance", async () => {
  const a = new FakeAudio(), b = new FakeAudio(), states: RecitationState[] = [];
  const warnings: unknown[][] = [], originalWarn = console.warn;
  let nextRequests = 0;
  console.warn = (...args) => warnings.push(args);
  const player = new QuranAudioPlayer([a, b], {
    source: async key => {
      if (key === "1:2") { nextRequests++; throw new Error("Recitation provider unavailable."); }
      return { url: key };
    },
    next, onState: state => states.push(state), onVerse: () => {},
  });
  try {
    player.play("1:1"); await settle();
    assert.equal(a.paused, false); assert.equal(states.at(-1)?.error, "");
    assert.equal(warnings.length, 1);
    a.finish(); await settle();
    assert.equal(nextRequests, 2);
    assert.equal(states.at(-1)?.error, "Unable to play this recitation. Please try again or choose another reciter.");
    assert.equal(states.at(-1)?.playing, false);
    assert.equal(states.at(-1)?.verseKey, null);
  } finally { player.dispose(); console.warn = originalWarn; }
});

test("stopping cancels pending audio and the Quran's final Ayah ends playback without looping", async () => {
  const a = new FakeAudio(), b = new FakeAudio(), states: RecitationState[] = [];
  let resolve: ((value: { url: string }) => void) | undefined, signal: AbortSignal | undefined;
  const player = new QuranAudioPlayer([a, b], {
    source: (_key, _reciter, requestSignal) => {
      signal = requestSignal; return new Promise(done => { resolve = done; });
    },
    next: () => null, onState: state => states.push(state), onVerse: () => {},
  });
  try {
    player.play("114:6"); player.stop();
    assert(signal?.aborted);
    resolve!({ url: "last" }); await settle();
    assert.equal(a.plays + b.plays, 0); assert.equal(states.at(-1)?.error, "");
  } finally { player.dispose(); }
  const finalPlayer = new QuranAudioPlayer([a, b], {
    source: async () => ({ url: "last" }), next: () => null,
    onState: state => states.push(state), onVerse: () => {},
  });
  try {
    finalPlayer.play("114:6"); await settle();
    a.finish(); await settle();
    assert.equal(states.at(-1)?.verseKey, null);
    assert.equal(states.at(-1)?.playing, false);
  } finally { finalPlayer.dispose(); }
  const surahs = Array.from({ length: 114 }, () => ({ ayahCount: 6 }));
  assert.equal(getAdjacentQuranVerse("114:6", 1, surahs), null);
  assert.equal(getAdjacentQuranVerse("1:1", -1, surahs), null);
});
