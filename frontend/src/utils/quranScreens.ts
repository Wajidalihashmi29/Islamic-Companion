export interface QuranReadingPosition {
  page: number;
  verseKey: string;
  wordOffset: number;
}

export const QURAN_PAGE_ASPECT_RATIO = 210 / 297;

export type QuranReaderPageNumber = number | "dua";

export function getAdjacentQuranReaderPage(page: QuranReaderPageNumber, direction: -1 | 1): QuranReaderPageNumber {
  if (page === "dua") return direction === 1 ? 1 : 604;
  if ((page === 604 && direction === 1) || (page === 1 && direction === -1)) return "dua";
  return page + direction;
}

export function getAdjacentQuranPage(page: number, direction: -1 | 1): number {
  return (page - 1 + direction + 604) % 604 + 1;
}

export function getQuranPageScale(width: number, height: number, availableWidth: number, availableHeight: number): number {
  if (width <= 0 || height <= 0 || availableWidth <= 0 || availableHeight <= 0) return 0;
  return Math.min(1, availableWidth / width, availableHeight / height);
}

export function getQuranPageWidth(width: number, contentHeight: number, aspectRatio = QURAN_PAGE_ASPECT_RATIO): number {
  const balanced = Math.sqrt(width * contentHeight * aspectRatio);
  return Math.max(480, Math.min(3200, Math.ceil(balanced / 8) * 8));
}

export function getQuranSwipeDirection(dx: number, dy: number, duration: number): -1 | 0 | 1 {
  if (duration > 800 || Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 2) return 0;
  return dx > 0 ? 1 : -1;
}

export function getZoomedQuranSwipeDirection(dx: number, dy: number, duration: number): -1 | 0 | 1 {
  if (duration > 450 || Math.abs(dx) < 120 || Math.abs(dx) < Math.abs(dy) * 2.5) return 0;
  return dx > 0 ? 1 : -1;
}

export function startsInSystemGestureZone(clientX: number, clientY: number, viewport: {
  left: number; top: number; width: number; height: number;
}): boolean {
  const edgeWidth = 32;
  const bottomHeight = 56;
  return clientX <= viewport.left + edgeWidth ||
    clientX >= viewport.left + viewport.width - edgeWidth ||
    clientY >= viewport.top + viewport.height - bottomHeight;
}
