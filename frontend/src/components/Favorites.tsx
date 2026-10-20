import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { getQuranDirectory } from "../api/quranApi";
import type { QuranDirectory } from "../api/quranApi";
import { getFriendlyErrorMessage } from "../utils/friendlyError";
import { loadQuranFavoriteSurahs } from "../utils/quranNavigation";
import { loadQuranNotes, loadRecentHadiths, loadSavedHadiths } from "../utils/personalLibrary";

export default function Favorites({ storageKey }: { storageKey: string }) {
  const [directory, setDirectory] = useState<QuranDirectory | null>(null);
  const [savedFavorites] = useState(() => {
    try { return { favorites: loadQuranFavoriteSurahs(storageKey), error: "" }; }
    catch { return { favorites: [] as number[], error: "Saved Quran favorites could not be read from browser storage." }; }
  });
  const [error, setError] = useState(savedFavorites.error);
  const [libraryVersion, setLibraryVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    getQuranDirectory(controller.signal).then(setDirectory).catch(requestError => {
      if (!controller.signal.aborted)
        setError(getFriendlyErrorMessage(requestError, "We couldn't load your Quran favorites right now."));
    });
    return () => controller.abort();
  }, [storageKey]);
  useEffect(() => {
    const update = () => setLibraryVersion(value => value + 1);
    window.addEventListener("ic:libraryUpdated", update);
    return () => window.removeEventListener("ic:libraryUpdated", update);
  }, []);

  const saved = directory?.surahs.filter(surah => savedFavorites.favorites.includes(surah.number)) ?? [];
  const savedHadiths = loadSavedHadiths(storageKey);
  const recentHadiths = loadRecentHadiths(storageKey);
  const quranNotes = loadQuranNotes(storageKey);
  void libraryVersion;
  return <section className="faith-panel">
    <div className="faith-intro"><span className="faith-icon"><Heart /></span>
      <div><h2>Favorites</h2></div>
    </div>
    {error && <p className="faith-error" role="alert">{error}</p>}
    <div className="favorites-grid">
      {saved.map(surah => <Link to={`/quran?page=${surah.startPage}&favorite=${surah.number}`} className="favorite-card" key={surah.number}>
        <span>{surah.number}</span><div><strong>{surah.name}</strong><small lang="ar" dir="rtl">{surah.nameArabic}</small></div>
        <span>Page {surah.startPage}</span>
      </Link>)}
    </div>
    {directory && !saved.length && <p className="faith-empty">You have no favorite Surahs yet. Open the Quran index and tap the heart beside a Surah.</p>}
    <h3>Quran page notes</h3>
    <div className="favorites-grid">
      {quranNotes.map(note => <Link key={note.page} to={`/quran?page=${note.page}`} className="favorite-card">
        <span>{note.page}</span><div><strong>Page {note.page}</strong><small>{note.text}</small></div><span>Open</span>
      </Link>)}
    </div>
    {!quranNotes.length && <p className="faith-empty">No Quran notes saved yet.</p>}
    <h3>Saved Hadith</h3>
    <div className="library-list">
      {savedHadiths.map(item => <article key={item.id}><strong>{item.bookName} · {item.hadithNumber}</strong><p lang="ur" dir="rtl">{item.translation}</p></article>)}
    </div>
    {!savedHadiths.length && <p className="faith-empty">No Hadith bookmarks saved yet.</p>}
    <h3>Recently opened Hadith</h3>
    <div className="library-list">
      {recentHadiths.slice(0, 5).map(item => <article key={item.id}><strong>{item.bookName} · {item.hadithNumber}</strong><p lang="ur" dir="rtl">{item.translation}</p></article>)}
    </div>
  </section>;
}
