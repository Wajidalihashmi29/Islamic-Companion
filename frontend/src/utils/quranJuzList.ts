export interface QuranJuzInfo {
  number: number;
  nameArabic: string;
  nameEnglish: string;
  startSurah: string;
  startVerse: string;
}

export const QURAN_JUZ_LIST: QuranJuzInfo[] = [
  { number: 1, nameArabic: "الم", nameEnglish: "Alif Lam Meem", startSurah: "Al-Fatihah", startVerse: "1:1" },
  { number: 2, nameArabic: "سَيَقُولُ", nameEnglish: "Sayaqool", startSurah: "Al-Baqarah", startVerse: "2:142" },
  { number: 3, nameArabic: "تِلْكَ الرُّسُلُ", nameEnglish: "Tilka ar-Rusul", startSurah: "Al-Baqarah", startVerse: "2:253" },
  { number: 4, nameArabic: "لَنْ تَنَالُوا", nameEnglish: "Lan Tanaaloo", startSurah: "Ali 'Imran", startVerse: "3:93" },
  { number: 5, nameArabic: "وَالْمُحْصَنَاتُ", nameEnglish: "Wal Muhsanat", startSurah: "An-Nisa", startVerse: "4:24" },
  { number: 6, nameArabic: "لَا يُحِبُّ اللَّهُ", nameEnglish: "La Yuhibbullahu", startSurah: "An-Nisa", startVerse: "4:148" },
  { number: 7, nameArabic: "وَإِذَا سَمِعُوا", nameEnglish: "Wa Iza Sami'oo", startSurah: "Al-Ma'idah", startVerse: "5:82" },
  { number: 8, nameArabic: "وَلَوْ أَنَّنَا", nameEnglish: "Wa Law Annana", startSurah: "Al-An'am", startVerse: "6:111" },
  { number: 9, nameArabic: "قَالَ الْمَلَأُ", nameEnglish: "Qalal Malao", startSurah: "Al-A'raf", startVerse: "7:88" },
  { number: 10, nameArabic: "وَاعْلَمُوا", nameEnglish: "Wa'lamoo", startSurah: "Al-Anfal", startVerse: "8:41" },
  { number: 11, nameArabic: "يَعْتَذِرُونَ", nameEnglish: "Ya'taziroona", startSurah: "At-Tawbah", startVerse: "9:93" },
  { number: 12, nameArabic: "وَمَا مِنْ دَابَّةٍ", nameEnglish: "Wa Mamin Da'abbatin", startSurah: "Hud", startVerse: "11:6" },
  { number: 13, nameArabic: "وَمَا أُبَرِّئُ", nameEnglish: "Wa Ma Ubarri'u", startSurah: "Yusuf", startVerse: "12:53" },
  { number: 14, nameArabic: "رُبَمَا", nameEnglish: "Rubama", startSurah: "Al-Hijr", startVerse: "15:2" },
  { number: 15, nameArabic: "سُبْحَانَ الَّذِي", nameEnglish: "Subhanallazi", startSurah: "Al-Isra", startVerse: "17:1" },
  { number: 16, nameArabic: "قَالَ أَلَمْ", nameEnglish: "Qala Alam", startSurah: "Al-Kahf", startVerse: "18:75" },
  { number: 17, nameArabic: "اقْتَرَبَ", nameEnglish: "Iqtaraba", startSurah: "Al-Anbiya", startVerse: "21:1" },
  { number: 18, nameArabic: "قَدْ أَفْلَحَ", nameEnglish: "Qad Aflaha", startSurah: "Al-Mu'minoon", startVerse: "23:1" },
  { number: 19, nameArabic: "وَقَالَ الَّذِينَ", nameEnglish: "Wa Qalallazina", startSurah: "Al-Furqan", startVerse: "25:21" },
  { number: 20, nameArabic: "أَمَّنْ خَلَقَ", nameEnglish: "A'man Khalaqa", startSurah: "An-Naml", startVerse: "27:60" },
  { number: 21, nameArabic: "اتْلُ مَا أُوحِيَ", nameEnglish: "Utlu Ma Oohiya", startSurah: "Al-'Ankaboot", startVerse: "29:46" },
  { number: 22, nameArabic: "وَمَنْ يَقْنُتْ", nameEnglish: "Wa Man Yaqnut", startSurah: "Al-Ahzab", startVerse: "33:31" },
  { number: 23, nameArabic: "وَمَا لِيَ", nameEnglish: "Wa Maliya", startSurah: "Ya-Seen", startVerse: "36:22" },
  { number: 24, nameArabic: "فَمَنْ أَظْلَمُ", nameEnglish: "Fa Man Azlamu", startSurah: "Az-Zumar", startVerse: "39:32" },
  { number: 25, nameArabic: "إِلَيْهِ يُرَدُّ", nameEnglish: "Ilayhi Yuraddu", startSurah: "Fussilat", startVerse: "41:47" },
  { number: 26, nameArabic: "حم", nameEnglish: "Ha'a Meem", startSurah: "Al-Ahqaf", startVerse: "46:1" },
  { number: 27, nameArabic: "قَالَ فَمَا خَطْبُكُمْ", nameEnglish: "Qala Fama Khatbukum", startSurah: "Adh-Dhariyat", startVerse: "51:31" },
  { number: 28, nameArabic: "قَدْ سَمِعَ اللَّهُ", nameEnglish: "Qad Sami'a Allahu", startSurah: "Al-Mujadila", startVerse: "58:1" },
  { number: 29, nameArabic: "تَبَارَكَ الَّذِي", nameEnglish: "Tabarakallazi", startSurah: "Al-Mulk", startVerse: "67:1" },
  { number: 30, nameArabic: "عَمَّ", nameEnglish: "'Amma", startSurah: "An-Naba", startVerse: "78:1" },
];

export const INDOPAK_JUZ_PAGES = [
  27, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  28, 28, 28, 28, 28, 28, 28, 28, 28, 26,
  28, 26, 28, 26, 30, 30, 30, 30, 32, 31,
];

export const TOTAL_PAGES_INDOPAK = 848;
export const MIN_PRINTED_PAGE = 2;
export const MAX_PRINTED_PAGE = 849;

export function getJuzPageCount(juzNumber: number): number {
  const idx = Math.max(1, Math.min(30, juzNumber)) - 1;
  return INDOPAK_JUZ_PAGES[idx] || 28;
}

export function getPrintedPageNumber(juz: number, pageInJuz: number): number {
  let sum = 2; // Scanned PDF page 1 of Juz 1 corresponds to printed page 2
  for (let i = 0; i < juz - 1 && i < INDOPAK_JUZ_PAGES.length; i++) {
    sum += INDOPAK_JUZ_PAGES[i];
  }
  return sum + pageInJuz - 1;
}

export function mapPrintedPageToJuz(targetPage: number): { juz: number; page: number; printedPage: number } {
  if (targetPage <= 2) {
    return { juz: 1, page: 1, printedPage: 2 };
  }
  const clamped = Math.min(MAX_PRINTED_PAGE, targetPage);
  let remaining = clamped - 2;
  for (let i = 0; i < INDOPAK_JUZ_PAGES.length; i++) {
    const count = INDOPAK_JUZ_PAGES[i];
    if (remaining < count) {
      return { juz: i + 1, page: remaining + 1, printedPage: clamped };
    }
    remaining -= count;
  }
  return { juz: 30, page: 31, printedPage: 849 };
}
