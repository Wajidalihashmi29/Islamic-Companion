import { queueCloudSave } from "./settingsStorage";

export interface SavedHadith {
  id: string;
  bookName: string;
  hadithNumber: string | number;
  arabic: string;
  translation: string;
  sourceUrl: string;
  savedAt: string;
}

export interface QuranPageNote {
  page: number;
  text: string;
  updatedAt: string;
}

const key = (profileKey: string, section: string) => `${profileKey}.${section}`;

function read<T>(storageKey: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function loadSavedHadiths(profileKey: string): SavedHadith[] {
  return read(key(profileKey, "hadithBookmarks"), []);
}

export function toggleSavedHadith(profileKey: string, hadith: Omit<SavedHadith, "id" | "savedAt">) {
  const id = `${hadith.sourceUrl}:${hadith.hadithNumber}`;
  const current = loadSavedHadiths(profileKey);
  const exists = current.some(item => item.id === id);
  const next = exists
    ? current.filter(item => item.id !== id)
    : [{ ...hadith, id, savedAt: new Date().toISOString() }, ...current];
  localStorage.setItem(key(profileKey, "hadithBookmarks"), JSON.stringify(next));
  window.dispatchEvent(new Event("ic:libraryUpdated"));
  queueCloudSave();
  return !exists;
}

export function saveRecentHadith(profileKey: string, hadith: Omit<SavedHadith, "id" | "savedAt">) {
  const id = `${hadith.sourceUrl}:${hadith.hadithNumber}`;
  const current = read<SavedHadith[]>(key(profileKey, "recentHadiths"), []);
  const next = [
    { ...hadith, id, savedAt: new Date().toISOString() },
    ...current.filter(item => item.id !== id),
  ].slice(0, 20);
  localStorage.setItem(key(profileKey, "recentHadiths"), JSON.stringify(next));
  queueCloudSave();
}

export function loadRecentHadiths(profileKey: string): SavedHadith[] {
  return read(key(profileKey, "recentHadiths"), []);
}

export function loadQuranNotes(profileKey: string): QuranPageNote[] {
  return read(key(profileKey, "quranNotes"), []);
}

export function loadQuranPageNote(profileKey: string, page: number): string {
  return loadQuranNotes(profileKey).find(note => note.page === page)?.text ?? "";
}

export function saveQuranPageNote(profileKey: string, page: number, text: string) {
  const current = loadQuranNotes(profileKey).filter(note => note.page !== page);
  const trimmed = text.trim();
  const next = trimmed
    ? [{ page, text: trimmed, updatedAt: new Date().toISOString() }, ...current]
    : current;
  localStorage.setItem(key(profileKey, "quranNotes"), JSON.stringify(next));
  window.dispatchEvent(new Event("ic:libraryUpdated"));
  queueCloudSave();
}

export function loadAzkarFavorites(profileKey: string): string[] {
  return read<string[]>(key(profileKey, "azkarFavorites"), []);
}

export function saveAzkarFavorites(profileKey: string, favorites: string[]): void {
  localStorage.setItem(key(profileKey, "azkarFavorites"), JSON.stringify(favorites));
  window.dispatchEvent(new Event("ic:libraryUpdated"));
  queueCloudSave();
}

export function toggleAzkarFavorite(profileKey: string, id: string): boolean {
  const current = loadAzkarFavorites(profileKey);
  const exists = current.includes(id);
  const next = exists ? current.filter(item => item !== id) : [...current, id];
  saveAzkarFavorites(profileKey, next);
  return !exists;
}

export function exportPersonalData(profileKey: string) {
  const settings = read<unknown>(profileKey, null);
  return {
    exportedAt: new Date().toISOString(),
    settings,
    hadithBookmarks: loadSavedHadiths(profileKey),
    recentHadiths: loadRecentHadiths(profileKey),
    quranNotes: loadQuranNotes(profileKey),
    azkarFavorites: loadAzkarFavorites(profileKey),
    calendarReminders: read<string[]>(key(profileKey, "calendarReminders"), []),
  };
}

export function deletePersonalData(profileKey: string) {
  [
    profileKey,
    key(profileKey, "hadithBookmarks"),
    key(profileKey, "recentHadiths"),
    key(profileKey, "quranNotes"),
    key(profileKey, "azkarFavorites"),
    key(profileKey, "calendarReminders"),
  ].forEach(storageKey => localStorage.removeItem(storageKey));
  window.dispatchEvent(new Event("ic:libraryUpdated"));
  queueCloudSave();
}
