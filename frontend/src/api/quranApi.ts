import client from "./axiosClient";

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
export interface QuranTafseer { verseKey: string; name: string; language: string; text: string }

export async function getQuranPage(page: number, translation: string, lines: number, signal: AbortSignal) {
  return (await client.get<QuranPage>(`/quran/page/${page}`, { params: { translation, lines }, signal })).data;
}
export async function getQuranDirectory(signal: AbortSignal) {
  return (await client.get<QuranDirectory>("/quran/directory", { signal })).data;
}
export async function getVersePage(key: string, signal?: AbortSignal) {
  const [surah, ayah] = key.split(":");
  return (await client.get<{ pageNumber: number }>(`/quran/verse/${surah}/${ayah}/page`, { signal })).data.pageNumber;
}
export async function getQuranAudio(key: string, reciter: string, signal: AbortSignal) {
  const [surah, ayah] = key.split(":");
  return (await client.get<{ verseKey: string; url: string }>(`/quran/audio/${surah}/${ayah}`, { params: { reciter }, signal })).data;
}
export async function getQuranTafseer(key: string, tafseer: string, signal: AbortSignal) {
  const [surah, ayah] = key.split(":");
  return (await client.get<QuranTafseer>(`/quran/tafseer/${surah}/${ayah}`, { params: { tafseer }, signal })).data;
}
