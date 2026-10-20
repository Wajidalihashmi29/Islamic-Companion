import { useEffect, useState } from "react";
import { BookOpen, Bookmark, ExternalLink, Search } from "lucide-react";
import { browseHadiths, getHadithBooks, searchHadiths } from "../api/hadithApi";
import type { HadithBook, HadithSearchItem } from "../api/hadithApi";
import { getFriendlyErrorMessage } from "../utils/friendlyError";
import CustomDropdown from "./CustomDropdown";
import { loadSavedHadiths, saveRecentHadith, toggleSavedHadith } from "../utils/personalLibrary";

type SearchScope = "translation" | "arabic" | "number";
type ResultMode = "search" | "browse";

export default function HadithCollection({ language, storageKey }: { language: string; storageKey: string }) {
  const [books, setBooks] = useState<HadithBook[]>([]);
  const [bookId, setBookId] = useState("all");
  const [scope, setScope] = useState<SearchScope>("translation");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HadithSearchItem[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [resultMode, setResultMode] = useState<ResultMode>("search");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [savedIds, setSavedIds] = useState(() => new Set(loadSavedHadiths(storageKey).map(item => item.id)));

  useEffect(() => {
    const controller = new AbortController();
    getHadithBooks(controller.signal).then(setBooks).catch(requestError => {
      if (!controller.signal.aborted)
        setError(getFriendlyErrorMessage(requestError, "We couldn't load the Hadith collection list. Please try again."));
    });
    return () => controller.abort();
  }, []);

  const search = async (nextPage = 1) => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setError("Enter at least two characters or a Hadith number with two or more digits.");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const data = await searchHadiths(trimmed, scope, bookId === "all" ? null : Number(bookId), nextPage);
      setResults(current => nextPage === 1 ? data.items : [...current, ...data.items]);
      setTotalResults(data.totalResults);
      setHasMore(data.hasMore);
      setPage(nextPage);
      setResultMode("search");
    } catch (requestError) {
      if (nextPage === 1) {
        setResults([]);
        setTotalResults(0);
        setHasMore(false);
      }
      setError(navigator.onLine
        ? getFriendlyErrorMessage(requestError, "We couldn't search the Hadith collection. Please try again.")
        : "Hadith search needs an internet connection. Reconnect and try again.");
    } finally {
      setLoading(false);
    }
  };

  const browse = async (nextPage = 1) => {
    if (bookId === "all") {
      setError("Select a Hadith collection to start reading.");
      return;
    }

    setLoading(true);
    setError("");
    setHasSearched(true);
    try {
      const data = await browseHadiths(Number(bookId), nextPage);
      setResults(current => nextPage === 1 ? data.items : [...current, ...data.items]);
      setTotalResults(current => nextPage === 1 ? data.items.length : current + data.items.length);
      setHasMore(data.hasMore);
      setPage(nextPage);
      setResultMode("browse");
    } catch (requestError) {
      if (nextPage === 1) {
        setResults([]);
        setTotalResults(0);
        setHasMore(false);
      }
      setError(navigator.onLine
        ? getFriendlyErrorMessage(requestError, "We couldn't load this Hadith collection. Please try again.")
        : "Reading Hadith collections needs an internet connection. Reconnect and try again.");
    } finally {
      setLoading(false);
    }
  };

  return <section className="faith-panel">
    <div className="faith-intro"><span className="faith-icon"><BookOpen /></span>
      <div><h2>Hadith Collection</h2><p>Search Hadith collection by number, Arabic matn, or Urdu translation.</p></div>
    </div>
    {language !== "ur" && <p className="faith-note">Dawat-e-Islami currently provides this collection in Arabic with Urdu translation.</p>}
    <form className="faith-hadith-controls" onSubmit={event => {
      event.preventDefault();
      void search(1);
    }}>
      <div className="faith-field"><span>Collection</span><CustomDropdown value={bookId}
        options={[{ id: "all", name: "All books" }, ...books.map(book => ({ id: String(book.id), name: book.name }))]}
        onChange={value => {
          setBookId(value);
          setError("");
        }} /></div>
      <div className="faith-field"><span>Search in</span><CustomDropdown value={scope}
        options={[
          { id: "translation", name: "Urdu translation" },
          { id: "arabic", name: "Arabic matn" },
          { id: "number", name: "Hadith number" },
        ]}
        onChange={value => setScope(value as SearchScope)} /></div>
      <button className="faith-secondary hadith-read-button" type="button" disabled={loading || bookId === "all"}
        onClick={() => void browse(1)}>Read selected collection</button>
      <div className="hadith-search-form">
        <label className="faith-search"><Search size={18} /><input type="search" value={query}
          inputMode={scope === "number" ? "numeric" : "search"}
          placeholder="Search by Hadith number or text"
          onChange={event => {
            setQuery(event.target.value);
            setError("");
          }} /></label>
        <button className="faith-primary" type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>
    </form>
    {error && <p className="faith-error" role="alert">{error}</p>}
    {loading && <p className="faith-status" role="status">Searching Hadith collection...</p>}
    {!loading && hasSearched && !error && <p className="hadith-result-count">
      {resultMode === "browse" ? `${totalResults} Hadith loaded` : `${totalResults} results found`}
    </p>}
    {!loading && !error && <div className="hadith-list">
      {results.map((hadith, index) => {
        const savedId = `${hadith.sourceUrl}:${hadith.hadithNumber}`;
        const libraryItem = {
          bookName: hadith.bookName,
          hadithNumber: hadith.hadithNumber,
          arabic: hadith.arabic,
          translation: hadith.translation,
          sourceUrl: hadith.sourceUrl,
        };
        return <article className="hadith-card"
        key={`${hadith.sourceUrl}:${hadith.hadithNumber}:${index}`}>
        <header>
          <span>{hadith.bookName} · Hadith {hadith.hadithNumber}</span>
          <span className="hadith-card-actions">
            <button type="button" aria-label="Save Hadith" aria-pressed={savedIds.has(savedId)} onClick={() => {
              toggleSavedHadith(storageKey, libraryItem);
              setSavedIds(new Set(loadSavedHadiths(storageKey).map(item => item.id)));
            }}><Bookmark size={15} fill={savedIds.has(savedId) ? "currentColor" : "none"} /></button>
            <a href={hadith.sourceUrl} target="_blank" rel="noreferrer"
              onClick={() => saveRecentHadith(storageKey, libraryItem)}>Source <ExternalLink size={14} /></a>
          </span>
        </header>
        <div className="hadith-text-columns">
          <section className="hadith-translation">
            <h3>Urdu translation</h3>
            <p data-no-translate lang="ur" dir="rtl">{hadith.translation}</p>
          </section>
          <section className="hadith-arabic">
            <h3>Original Arabic</h3>
            <p data-no-translate lang="ar" dir="rtl">{hadith.arabic}</p>
          </section>
        </div>
      </article>;
      })}
      {hasSearched && !results.length && <p className="faith-empty">
        {resultMode === "browse" ? "No readable Hadith were returned for this collection." : "No Hadith matched your search."}
      </p>}
    </div>}
    {!loading && results.length > 0 && hasMore &&
      <button className="faith-secondary hadith-load-more" type="button"
        onClick={() => void (resultMode === "browse" ? browse(page + 1) : search(page + 1))}>
        Load more Hadith
      </button>}
    <p className="faith-note">Source: Faizan-e-Hadees by Dawat-e-Islami. Open the source link to read the available commentary and references.</p>
  </section>;
}
