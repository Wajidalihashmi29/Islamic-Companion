import type { QuranReadingPosition } from "./quranScreens";

function normalizeDigits(text: string) {
  return text
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0));
}

export function normalizeQuranSearch(text: string) {
  return normalizeDigits(text.normalize("NFKD").replace(/\p{M}|[\sـ-]/gu, "").toLowerCase());
}

export function parseAyahReference(text: string): string | null {
  const match = /^(\d{1,3})\s*:\s*(\d{1,3})$/.exec(normalizeDigits(text.normalize("NFKC").trim()));
  return match ? `${Number(match[1])}:${Number(match[2])}` : null;
}

export function loadQuranReadingPage(profileKey: string): number | null {
  const saved = localStorage.getItem(`${profileKey}:quran-page`);
  if (saved === null) return null;
  const page: unknown = JSON.parse(saved);
  if (typeof page !== "number" || !Number.isInteger(page) || page < 1 || page > 604)
    throw new Error("The saved Quran reading page is invalid.");
  return page;
}

export function saveQuranReadingPage(profileKey: string, page: number): void {
  if (!Number.isInteger(page) || page < 1 || page > 604)
    throw new Error("The Quran reading page must be between 1 and 604.");
  localStorage.setItem(`${profileKey}:quran-page`, JSON.stringify(page));
}

function validateFavoriteSurahs(value: unknown): number[] {
  if (!Array.isArray(value) || value.some(number =>
    typeof number !== "number" || !Number.isInteger(number) || number < 1 || number > 114))
    throw new Error("Favourite Surahs must be valid Surah numbers from 1 to 114.");
  return [...new Set<number>(value)].sort((a, b) => a - b);
}

export function loadQuranFavoriteSurahs(profileKey: string): number[] {
  const saved = localStorage.getItem(`${profileKey}:quran-favorite-surahs`);
  return saved === null ? [] : validateFavoriteSurahs(JSON.parse(saved));
}

export function saveQuranFavoriteSurahs(profileKey: string, surahs: number[]): void {
  localStorage.setItem(`${profileKey}:quran-favorite-surahs`, JSON.stringify(validateFavoriteSurahs(surahs)));
}

export interface QuranReaderView {
  mode: "scroll" | "fit";
  position: QuranReadingPosition | null;
}

export function loadQuranReaderView(profileKey: string, defaultMode: QuranReaderView["mode"] = "scroll"): QuranReaderView {
  const saved = localStorage.getItem(`${profileKey}:quran-view`);
  if (saved === null) return { mode: defaultMode, position: null };
  const view: unknown = JSON.parse(saved);
  if (typeof view !== "object" || view === null || !("mode" in view) ||
    (view.mode !== "scroll" && view.mode !== "fit" && view.mode !== "screens") || !("position" in view))
    throw new Error("The saved Quran reading view is invalid.");
  const mode = view.mode === "screens" ||
    (defaultMode === "fit" && view.mode === "scroll" && (!("version" in view) || view.version !== 2))
    ? "fit" : view.mode;
  if (view.position === null) return { mode, position: null };
  const position = view.position;
  if (typeof position !== "object" || position === null ||
    !("page" in position) || typeof position.page !== "number" || !Number.isInteger(position.page) ||
    position.page < 1 || position.page > 604 ||
    !("verseKey" in position) || typeof position.verseKey !== "string" ||
    parseAyahReference(position.verseKey) !== position.verseKey ||
    !("wordOffset" in position) || typeof position.wordOffset !== "number" ||
    !Number.isInteger(position.wordOffset) || position.wordOffset < 0)
    throw new Error("The saved Quran screen position is invalid.");
  const [surah, ayah] = position.verseKey.split(":").map(Number);
  if (surah < 1 || surah > 114 || ayah < 1)
    throw new Error("The saved Quran screen position is invalid.");
  return { mode, position: null };
}

export function saveQuranReaderView(profileKey: string, view: QuranReaderView): void {
  localStorage.setItem(`${profileKey}:quran-view`, JSON.stringify({ ...view, version: 2 }));
}
