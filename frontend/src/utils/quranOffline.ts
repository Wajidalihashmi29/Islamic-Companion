const QURAN_CACHE = "islamic-companion-quran-v1";
const OFFLINE_VERSION = 1;
const TOTAL_QURAN_PAGES = 604;

export interface QuranOfflineProgress {
  translation: string;
  lines: number;
  state: "idle" | "downloading" | "ready" | "paused" | "error" | "unsupported";
  completed: number;
  total: number;
}

const progressListeners = new Set<(progress: QuranOfflineProgress) => void>();

function reportProgress(progress: QuranOfflineProgress) {
  progressListeners.forEach(listener => listener(progress));
}

export function subscribeQuranOfflineProgress(listener: (progress: QuranOfflineProgress) => void) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

function apiUrl(path: string, apiBaseUrl: string | undefined, origin: string) {
  const base = new URL(apiBaseUrl || "/api", origin);
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  return new URL(path.replace(/^\//, ""), base);
}

export function getQuranOfflineUrls(apiBaseUrl: string | undefined, origin: string,
  translation: string, lines: number) {
  const directory = apiUrl("quran/directory", apiBaseUrl, origin).href;
  const pages = Array.from({ length: TOTAL_QURAN_PAGES }, (_, index) => {
    const url = apiUrl(`quran/page/${index + 1}`, apiBaseUrl, origin);
    url.searchParams.set("translation", translation);
    url.searchParams.set("lines", String(lines));
    return url.href;
  });
  return [directory, ...pages];
}

const activeDownloads = new Map<string, Promise<void>>();

export function getQuranOfflineCompletionKey(translation: string, lines: number) {
  return `ic.quranOffline.${OFFLINE_VERSION}.${translation}.${lines}`;
}

export function prepareQuranOffline(translation: string, lines: number) {
  const baseProgress = { translation, lines, completed: 0, total: TOTAL_QURAN_PAGES + 1 };
  if (import.meta.env.DEV) {
    reportProgress({ ...baseProgress, state: "unsupported" });
    return Promise.resolve();
  }
  if (!("caches" in window)) {
    reportProgress({ ...baseProgress, state: "unsupported" });
    return Promise.resolve();
  }
  if (!navigator.onLine) {
    reportProgress({ ...baseProgress, state: "paused" });
    return Promise.resolve();
  }
  const downloadKey = `${translation}:${lines}`;
  const activeDownload = activeDownloads.get(downloadKey);
  if (activeDownload) return activeDownload;

  const download = (async () => {
    const urls = getQuranOfflineUrls(import.meta.env.VITE_API_BASE_URL, window.location.origin, translation, lines);
    const completionKey = getQuranOfflineCompletionKey(translation, lines);
    const cache = await caches.open(QURAN_CACHE);
    if (localStorage.getItem(completionKey) === "complete" &&
      await cache.match(urls[0]) && await cache.match(urls[1]) && await cache.match(urls.at(-1)!)) {
      reportProgress({ ...baseProgress, state: "ready", completed: urls.length, total: urls.length });
      return;
    }

    let next = 0, completed = 0;
    reportProgress({ ...baseProgress, state: "downloading", total: urls.length });
    const download = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        if (!await cache.match(url)) {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Unable to cache Quran data (${response.status}).`);
          await cache.put(url, response);
        }
        completed++;
        if (completed === urls.length || completed % 5 === 0)
          reportProgress({ ...baseProgress, state: "downloading", completed, total: urls.length });
      }
    };
    await Promise.all(Array.from({ length: 3 }, download));
    localStorage.setItem(completionKey, "complete");
    reportProgress({ ...baseProgress, state: "ready", completed: urls.length, total: urls.length });
  })().catch(error => {
    reportProgress({ ...baseProgress, state: navigator.onLine ? "error" : "paused" });
    throw error;
  }).finally(() => {
    activeDownloads.delete(downloadKey);
  });

  activeDownloads.set(downloadKey, download);
  return download;
}

export async function getOfflineQuranStorageInfo() {
  if (!("caches" in window)) return { supported: false, entries: 0, bytes: 0 };
  const cache = await caches.open(QURAN_CACHE);
  const requests = await cache.keys();
  let bytes = 0;
  for (const request of requests) {
    const response = await cache.match(request);
    const value = Number(response?.headers.get("content-length"));
    if (Number.isFinite(value)) bytes += value;
  }
  return { supported: true, entries: requests.length, bytes };
}

export async function clearOfflineQuran() {
  if ("caches" in window) await caches.delete(QURAN_CACHE);
  for (let index = localStorage.length - 1; index >= 0; index--) {
    const storageKey = localStorage.key(index);
    if (storageKey?.startsWith(`ic.quranOffline.${OFFLINE_VERSION}.`)) {
      localStorage.removeItem(storageKey);
    }
  }
}
