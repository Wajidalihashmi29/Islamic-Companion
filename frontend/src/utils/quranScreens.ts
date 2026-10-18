export interface QuranReadingPosition {
  page: number;
  verseKey: string;
  wordOffset: number;
}

export const QURAN_PAGE_ASPECT_RATIO = 210 / 297;

export function getQuranPageScale(width: number, height: number, availableWidth: number, availableHeight: number): number {
  if (width <= 0 || height <= 0 || availableWidth <= 0 || availableHeight <= 0) return 0;
  return Math.min(1, availableWidth / width, availableHeight / height);
}

export function getQuranPageWidth(width: number, contentHeight: number): number {
  const balanced = Math.sqrt(width * contentHeight * QURAN_PAGE_ASPECT_RATIO);
  return Math.max(480, Math.min(3200, Math.ceil(balanced / 8) * 8));
}

export function getQuranSwipeDirection(dx: number, dy: number, duration: number): -1 | 0 | 1 {
  if (duration > 800 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return 0;
  return dx > 0 ? 1 : -1;
}
