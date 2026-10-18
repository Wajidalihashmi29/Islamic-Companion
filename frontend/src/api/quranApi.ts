import client from "./axiosClient";
import { formatFatihahPage, getCanonicalQuranVerse } from "../utils/quranFatihah";

export interface QuranSurah {
  number: number;
  nameArabic: string;
  name: string;
  revelationPlace: string;
  ayahCount: number;
  rukuCount: number;
  startPage: number;
}
export interface QuranSegment {
  verseKey: string;
  verseNumberInSurah: number;
  surahNumber: number;
  textIndoPak: string;
  textUthmani: string;
  endsAyah: boolean;
  isSajdah: boolean;
  isRukuEnd: boolean;
  rukuNumberInSurah: number;
  rukuNumberOverall: number;
  rukuNumberInJuz: number;
  rukuAyahCount: number;
  translation: string;
}
export interface QuranLine {
  lineNumber: number;
  textIndoPak: string;
  translation: string;
  surahHeaderBeforeLine: QuranSurah | null;
  isJuzStart: boolean;
  segments: QuranSegment[];
}
export interface QuranPage {
  pageNumber: number;
  juzNumber: number;
  juzNameArabic: string;
  manzilNumber: number;
  translationLanguage: string;
  bismillahTranslation: string;
  lines: QuranLine[];
}
export interface QuranDirectory {
  surahs: QuranSurah[];
  juzs: { number: number; nameArabic: string; verseKey: string }[];
}
export interface QuranTafseer {
  verseKey: string; name: string; language: string; text: string; author: string; sourceUrl: string;
}

const pageCache = new Map<string, QuranPage>();
const pageRequests = new Map<string, {
  controller: AbortController; promise: Promise<QuranPage>; consumers: Set<symbol>;
}>();
const pageCacheKey = (page: number, translation: string, lines: number) => `${page}:${translation}:${lines}`;

export async function getQuranPage(page: number, translation: string, lines: number, signal: AbortSignal) {
  signal.throwIfAborted();
  const key = pageCacheKey(page, translation, lines);
  const cached = pageCache.get(key);
  if (cached) {
    pageCache.delete(key);
    pageCache.set(key, cached);
    return cached;
  }
  let request = pageRequests.get(key);
  if (!request) {
    const controller = new AbortController();
    const promise = client.get<QuranPage>(`/quran/page/${page}`, {
      params: { translation, lines }, signal: controller.signal,
    }).then(response => {
      controller.signal.throwIfAborted();
      const page = formatFatihahPage(response.data, translation);
      pageCache.set(key, page);
      const oldest = pageCache.keys().next().value;
      if (pageCache.size > 8 && oldest !== undefined) pageCache.delete(oldest);
      return page;
    }).finally(() => {
      if (pageRequests.get(key)?.controller === controller) pageRequests.delete(key);
    });
    request = { controller, promise, consumers: new Set() };
    pageRequests.set(key, request);
  }
  const pending = request, consumer = Symbol();
  pending.consumers.add(consumer);
  return new Promise<QuranPage>((resolve, reject) => {
    let finished = false;
    const release = () => {
      if (finished) return;
      finished = true;
      signal.removeEventListener("abort", abort);
      pending.consumers.delete(consumer);
      if (!pending.consumers.size) {
        if (pageRequests.get(key) === pending) pageRequests.delete(key);
        pending.controller.abort();
      }
    };
    const abort = () => { release(); reject(signal.reason); };
    signal.addEventListener("abort", abort, { once: true });
    pending.promise.then(data => { release(); resolve(data); }, error => { release(); reject(error); });
  });
}
export async function getQuranDirectory(signal: AbortSignal) {
  return (await client.get<QuranDirectory>("/quran/directory", { signal })).data;
}
export async function getVersePage(key: string, signal?: AbortSignal) {
  const [surah, ayah] = getCanonicalQuranVerse(key).split(":");
  return (await client.get<{ pageNumber: number }>(`/quran/verse/${surah}/${ayah}/page`, { signal })).data.pageNumber;
}
export async function getQuranAudio(key: string, reciter: string, signal: AbortSignal) {
  const [surah, ayah] = key.split(":");
  return (await client.get<{ verseKey: string; url: string }>(`/quran/audio/${surah}/${ayah}`, { params: { reciter }, signal })).data;
}
export async function getQuranTafseer(key: string, tafseer: string, signal: AbortSignal) {
  const [surah, ayah] = getCanonicalQuranVerse(key).split(":");
  const result = (await client.get<QuranTafseer>(`/quran/tafseer/${surah}/${ayah}`, { params: { tafseer }, signal })).data;
  return { ...result, verseKey: key };
}
