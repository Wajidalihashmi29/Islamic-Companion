import client from "./axiosClient";

export interface HadithBook {
  id: number;
  name: string;
}

export interface HadithSearchItem {
  hadithNumber: number;
  bookName: string;
  arabic: string;
  translation: string;
  sourceUrl: string;
}

export interface HadithSearchResult {
  totalResults: number;
  hasMore: boolean;
  items: HadithSearchItem[];
}

export async function getHadithBooks(signal?: AbortSignal) {
  const response = await client.get<HadithBook[]>("/hadith/books", { signal });
  return response.data;
}

export async function searchHadiths(
  query: string,
  scope: "translation" | "arabic" | "number",
  bookId: number | null,
  page: number,
  signal?: AbortSignal,
) {
  const response = await client.get<HadithSearchResult>("/hadith/search", {
    params: { query, scope, bookId, page },
    signal,
  });
  return response.data;
}

export async function browseHadiths(bookId: number, page: number, signal?: AbortSignal) {
  const response = await client.get<HadithSearchResult>("/hadith/browse", {
    params: { bookId, page },
    signal,
  });
  return response.data;
}
