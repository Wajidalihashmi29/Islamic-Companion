export const DEFAULT_QURAN_RECITER = "shuraim";

export const RECITERS_OPTIONS = [
  { id: "shuraim", name: "Saud Al-Shuraim", sub: "Default reciter · Former Imam of Masjid al-Haram" },
  { id: "sudais", name: "Sheikh Abdur-Rahman As-Sudais", sub: "Imam of Masjid al-Haram" },
  { id: "abdul-basit", name: "Abdul Basit Abdus Samad", sub: "Classic Mujawwad / Murattal" },
  { id: "alafasy", name: "Mishary Rashid Alafasy", sub: "Clear & Melodic" },
  { id: "husary", name: "Mahmoud Khalil Al-Husary", sub: "Master of Tajweed" },
];

export function normalizeReciter(reciter: string): string {
  return RECITERS_OPTIONS.some(option => option.id === reciter) ? reciter : DEFAULT_QURAN_RECITER;
}
