import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { getQuranDirectory } from "../api/quranApi";
import type { QuranDirectory } from "../api/quranApi";
import { getFriendlyErrorMessage } from "../utils/friendlyError";
import { loadQuranFavoriteSurahs } from "../utils/quranNavigation";

export default function Favorites({ storageKey }: { storageKey: string }) {
  const [directory, setDirectory] = useState<QuranDirectory | null>(null);
  const [savedFavorites] = useState(() => {
    try { return { favorites: loadQuranFavoriteSurahs(storageKey), error: "" }; }
    catch { return { favorites: [] as number[], error: "Saved Quran favorites could not be read from browser storage." }; }
  });
  const [error, setError] = useState(savedFavorites.error);

  useEffect(() => {
    const controller = new AbortController();
    getQuranDirectory(controller.signal).then(setDirectory).catch(requestError => {
      if (!controller.signal.aborted)
        setError(getFriendlyErrorMessage(requestError, "We couldn't load your Quran favorites right now."));
    });
    return () => controller.abort();
  }, [storageKey]);

  const saved = directory?.surahs.filter(surah => savedFavorites.favorites.includes(surah.number)) ?? [];
  return <section className="faith-panel">
    <div className="faith-intro"><span className="faith-icon"><Heart /></span>
      <div><h2>Favorites</h2><p>Return to the Surahs you marked as favorites in the Quran reader.</p></div>
    </div>
    {error && <p className="faith-error" role="alert">{error}</p>}
    <div className="favorites-grid">
      {saved.map(surah => <Link to={`/quran?page=${surah.startPage}&favorite=${surah.number}`} className="favorite-card" key={surah.number}>
        <span>{surah.number}</span><div><strong>{surah.name}</strong><small lang="ar" dir="rtl">{surah.nameArabic}</small></div>
        <span>Page {surah.startPage}</span>
      </Link>)}
    </div>
    {directory && !saved.length && <p className="faith-empty">You have no favorite Surahs yet. Open the Quran index and tap the heart beside a Surah.</p>}
  </section>;
}
