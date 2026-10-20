import { Fragment, useDeferredValue, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronLeft, ChevronRight, Download, Expand, Headphones, LoaderCircle,
  MoreHorizontal, PanelsTopLeft, Pause, Play, Settings2, SkipBack, SkipForward, Star, WifiOff, X, ZoomIn, ZoomOut } from "lucide-react";
import TopNav from "../components/TopNav";
import CustomDropdown from "../components/CustomDropdown";
import AyahMedallion, { toArabicDigits, toUrduDigits } from "../components/AyahMedallion";
import QuranText from "../components/QuranText";
import QuranCompletionPage from "../components/QuranCompletionPage";
import UnderConstructionModal from "../components/UnderConstructionModal";
import { useAuth } from "../context/AuthContext";
import { getQuranAudio, getQuranDirectory, getQuranPage, getQuranTafseer, getVersePage } from "../api/quranApi";
import type { QuranDirectory, QuranPage, QuranSurah, QuranTafseer } from "../api/quranApi";
import { layoutQuranLines } from "../utils/quranLayout";
import type { QuranReadingLine, QuranReadingSegment } from "../utils/quranLayout";
import { getQuranLineHeightMultiplier, getQuranTextRuns } from "../utils/quranTypography";
import { getStorageKeyForUser, loadSettings, saveSettings, RECITERS_OPTIONS, TRANSLATION_OPTIONS, TAFSEER_OPTIONS } from "../utils/settingsStorage";
import { loadQuranFavoriteSurahs, loadQuranReaderView, loadQuranReadingPage, normalizeQuranSearch, parseAyahReference,
  saveQuranFavoriteSurahs, saveQuranReaderView, saveQuranReadingPage } from "../utils/quranNavigation";
import { getAdjacentQuranPage, getAdjacentQuranReaderPage, getQuranPageScale, getQuranPageWidth, getQuranSwipeDirection, QURAN_PAGE_ASPECT_RATIO, startsInSystemGestureZone } from "../utils/quranScreens";
import type { QuranReaderPageNumber } from "../utils/quranScreens";
import { getAdjacentQuranVerse, QuranAudioPlayer } from "../utils/quranAudio";
import { getCanonicalQuranVerse, getReaderQuranVerse } from "../utils/quranFatihah";
import { prepareQuranOffline, subscribeQuranOfflineProgress } from "../utils/quranOffline";
import type { QuranOfflineProgress } from "../utils/quranOffline";
import { getFriendlyErrorMessage } from "../utils/friendlyError";
import type { AppSettings } from "../utils/settingsStorage";
import type { RecitationState } from "../utils/quranAudio";
import "./Home.css";
import "./QuranReaderPage.css";

// Color V4 uses individual glyph codes, not the V2 surahNNN ligatures.
const SURAH_COLOR_GLYPHS =
  "\uFC45\uFC46\uFC47\uFC4A\uFC4B\uFC4E\uFC4F\uFC51\uFC52\uFC53\uFC55\uFC56\uFC58\uFC5A\uFC5B\uFC5C\uFC5D\uFC5E\uFC61\uFC62\uFC64" +
  "\uFB51\uFB52\uFB54\uFB55\uFB57\uFB58\uFB5A\uFB5B\uFB5D\uFB5E\uFB60\uFB61\uFB63\uFB64\uFB66\uFB67\uFB69\uFB6A\uFB6C\uFB6D" +
  "\uFB6F\uFB70\uFB72\uFB73\uFB75\uFB76\uFB78\uFB79\uFB7B\uFB7C\uFB7E\uFB7F\uFB81\uFB82\uFB84\uFB85\uFB87\uFB88\uFB8A\uFB8B" +
  "\uFB8D\uFB8E\uFB90\uFB91\uFB93\uFB94\uFB96\uFB97\uFB99\uFB9A\uFB9C\uFB9D\uFB9F\uFBA0\uFBA2\uFBA3\uFBA5\uFBA6\uFBA8\uFBA9" +
  "\uFBAB\uFBAC\uFBAE\uFBAF\uFBB1\uFBB2\uFBB4\uFBB5\uFBB7\uFBB8\uFBBA\uFBBB\uFBBD\uFBBE\uFBC0\uFBC1" +
  "\uFBD3\uFBD4\uFBD6\uFBD7\uFBD9\uFBDA\uFBDC\uFBDD\uFBDF\uFBE0\uFBE2\uFBE3\uFBE5\uFBE6\uFBE8\uFBE9\uFBEB";

function errorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const status = error.response?.status;
    if (status !== undefined && status < 500) return error.response?.data?.message || fallback;
  }
  return getFriendlyErrorMessage(error, fallback, {
    offlineMessage: "This Quran content is not available offline yet. Reconnect once to download it.",
  });
}

function captureReadingPage(sheet: HTMLElement, viewport: HTMLElement) {
  const bounds = viewport.getBoundingClientRect(), position = sheet.getBoundingClientRect();
  const copy = sheet.cloneNode(true);
  if (!(copy instanceof HTMLElement)) throw new Error("Unable to retain the Quran reading page.");
  Object.assign(copy.style, { position: "absolute", left: `${position.left - bounds.left}px`,
    top: `${position.top - bounds.top}px`, width: `${sheet.offsetWidth}px`, height: `${sheet.offsetHeight}px`,
    transform: getComputedStyle(sheet).transform, visibility: "visible" });
  return { copy, bounds: { left: `${bounds.left}px`, top: `${bounds.top}px`,
    width: `${bounds.width}px`, height: `${bounds.height}px` } };
}

function showReadingPage(surface: HTMLElement, snapshot: ReturnType<typeof captureReadingPage>) {
  Object.assign(surface.style, snapshot.bounds);
  surface.replaceChildren(snapshot.copy.cloneNode(true));
  surface.classList.add("is-visible");
}

function QuranGlyph({ text, script, className, label, alignment = "xMidYMax meet" }: {
  text: string; script: string; className: string; label: string; alignment?: string;
}) {
  const ref = useRef<SVGTextElement>(null);
  const [measurement, setMeasurement] = useState({ text: "", script: "", viewBox: "" });
  const viewBox = measurement.text === text && measurement.script === script ? measurement.viewBox : "";
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("Unable to measure Quran glyphs.");
    let disposed = false;
    const fit = () => {
      if (disposed || !element.isConnected || document.fonts.status === "loading") return;
      const style = getComputedStyle(element);
      context.font = `${style.fontSize} ${style.fontFamily}`;
      context.direction = "ltr";
      const { actualBoundingBoxLeft: left, actualBoundingBoxRight: right,
        actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = context.measureText(text);
      setMeasurement({ text, script,
        viewBox: `${-left - 1} ${-ascent - 1} ${left + right + 2} ${ascent + descent + 2}` });
    };
    fit();
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      disposed = true;
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [text, script]);
  return (
    <svg className={className} viewBox={viewBox || undefined} preserveAspectRatio={alignment}
      role="img" aria-label={label} data-quran-glyph-ready={!!viewBox}
      style={{ visibility: viewBox ? "visible" : "hidden" }}>
      <text ref={ref} x="0" y="0" fill="currentColor" fontSize="32" direction="ltr"
        style={{ direction: "ltr", letterSpacing: "normal" }}>{text}</text>
    </svg>
  );
}

function AyahStopSigns({ signs, script }: { signs: string; script: string }) {
  const text = Array.from(signs, sign => {
    const glyph = sign === "\uE022" ? "ع" : sign === "\u06D8" ? "م" : sign;
    // Give each combining pause sign its own blank base so marks cannot stack across spaces.
    return `\u00A0${glyph}`;
  }).join("\u2002");
  return <QuranGlyph text={text} script={script} className="quran-ayah-stop-signs" label="Verse-ending stop signs" />;
}

function QuranNumber({ value, script }: { value: string | number; script: AppSettings["quran"]["arabicScript"] }) {
  const text = script === "indopak" ? toUrduDigits(value) : toArabicDigits(value);
  return <QuranGlyph text={text} script={script} className="quran-number" label={text} />;
}

function RukuMark({ segment, script, juz }: {
  segment: QuranReadingSegment; script: AppSettings["quran"]["arabicScript"]; juz: number;
}) {
  const label = `Ruku ${segment.rukuNumberInSurah} in Surah ${segment.surahNumber}, ${segment.rukuAyahCount} Ayahs, Ruku ${segment.rukuNumberInJuz} in Para ${juz}`;
  return <span className="quran-ruku-mark" lang="ar" dir="rtl" role="img" aria-label={label}
    title={label} data-verse-key={segment.verseKey}>
    <span className="quran-ruku-number"><QuranNumber value={segment.rukuNumberInSurah} script={script} /></span>
    <span className="quran-ruku-body" aria-hidden="true">
      <QuranGlyph text="ع" script={script} className="quran-ruku-symbol" label="Ruku" alignment="xMidYMid meet" />
      <span className="quran-ruku-ayahs"><QuranNumber value={segment.rukuAyahCount} script={script} /></span>
    </span>
    <span className="quran-ruku-number"><QuranNumber value={segment.rukuNumberInJuz} script={script} /></span>
  </span>;
}

function AyahMarkers({ segment, settings, onOpen }: {
  segment: QuranReadingSegment; settings: AppSettings["quran"]; onOpen: (key: string) => void;
}) {
  if (!segment.endsAyah) return null;
  return (
    <span className="quran-inline-markers">
      {segment.isSajdah && <span aria-label="Ayat-e-Sajdah">۩</span>}
      <button type="button" className="quran-ayah-seal" aria-label={`Read Tafseer for Ayah ${segment.verseKey}`}
        onClick={event => { event.stopPropagation(); onOpen(segment.verseKey); }}>
        <AyahMedallion number={segment.verseNumberInSurah} size={Math.max(32, settings.arabicFontSize)}
          isIndoPak={settings.arabicScript === "indopak"} />
        {segment.ayahStopSigns && <AyahStopSigns signs={segment.ayahStopSigns} script={settings.arabicScript} />}
      </button>
    </span>
  );
}

function ReaderDrawer({ title, description, icon, children, onClose, className = "" }: {
  title: string; description: string; icon: ReactNode; children: ReactNode; onClose: () => void; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const trigger = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog ref={ref} className={`quran-drawer ${className}`} aria-labelledby={id} aria-describedby={`${id}-description`}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]"))
          .filter(element => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
        const first = controls[0], last = controls.at(-1);
        if (document.activeElement === (event.shiftKey ? first : last)) {
          event.preventDefault();
          (event.shiftKey ? last : first)?.focus();
        }
      }}
      onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="quran-drawer-content">
        <header>
          <span className="quran-menu-icon" aria-hidden="true">{icon}</span>
          <div className="quran-drawer-heading"><span className="quran-menu-eyebrow">Quran reader</span>
            <h2 id={id}>{title}</h2><p id={`${id}-description`}>{description}</p></div>
          <button type="button" className="quran-icon-button" aria-label="Close drawer" onClick={onClose}><X size={20} /></button>
        </header>
        <div className="quran-drawer-body">{children}</div>
      </div>
    </dialog>
  );
}

function SurahBanner({ surah, page, settings }: { surah: QuranSurah; page: QuranPage; settings: AppSettings["quran"] }) {
  return (
    <>
      <div className="quran-surah-banner" lang="ar" dir="rtl">
        <div className="quran-surah-stat">رُكُوعُهَا<strong><QuranNumber value={surah.rukuCount} script={settings.arabicScript} /></strong></div>
        <h2><span className="quran-surah-number"><QuranNumber value={surah.number} script={settings.arabicScript} /></span>
          <span className="quran-surah-heading">
            {/* The supplied V2 font maps Al-Ahzab to "033", without the usual prefix. */}
            <QuranGlyph text={surah.number === 33 ? "033" : `surah${String(surah.number).padStart(3, "0")}`} script="surah-name-v2"
              className="quran-surah-name" label={`سُورَةُ ${surah.nameArabic}`} />
            <small>{surah.revelationPlace === "makkah" ? "مَكِّيَّةٌ" : "مَدَنِيَّةٌ"}</small>
          </span></h2>
        <div className="quran-surah-stat">آيَاتُهَا<strong><QuranNumber value={surah.ayahCount} script={settings.arabicScript} /></strong></div>
      </div>
      {surah.number !== 9 && (
        <div className="quran-bismillah">
          <p className="quran-bismillah-arabic" lang="ar" dir="rtl" style={{ fontSize: settings.arabicFontSize }}>
            <span aria-hidden="true">❊</span>
            <QuranGlyph text={"\uFC41 \uFC42 \uFC43 \uFC44"} script="qpc-v2"
              className="quran-bismillah-glyph" label="بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ" />
            <span aria-hidden="true">❊</span>
          </p>
          {settings.showTranslation && <p lang={page.translationLanguage}
            style={{ fontSize: settings.translationFontSize }}>{page.bismillahTranslation}</p>}
        </div>
      )}
    </>
  );
}

function TranslationText({ text, script }: { text: string; script: AppSettings["quran"]["arabicScript"] }) {
  return text.split(/(\S+\s+﴿[۰-۹]+﴾)/u).map((part, index) => {
    const ending = /^(\S+)\s+(﴿[۰-۹]+﴾)$/u.exec(part);
    return ending ? <span className="quran-translation-ending" key={index}>{ending[1]}{" "}
      <span className="quran-translation-marker">﴿<QuranNumber value={ending[2].slice(1, -1)} script={script} />﴾</span></span> : part;
  });
}

export default function QuranReaderPage() {
  const { userIdentifier } = useAuth();
  const profileKey = getStorageKeyForUser(userIdentifier);
  return <QuranReader key={profileKey} profileKey={profileKey} />;
}

function QuranReader({ profileKey }: { profileKey: string }) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const [mobileReader, setMobileReader] = useState(() => window.matchMedia("(max-width: 900px)").matches);
  const [resume] = useState(() => {
    let page = 1;
    try {
      page = loadQuranReadingPage(profileKey) ?? 1;
      return { page, view: loadQuranReaderView(profileKey, mobileReader ? "fit" : "scroll"), error: "" };
    } catch (error) {
      console.warn("Unable to load Quran reading progress.", error);
      return { page, view: { mode: mobileReader ? "fit" : "scroll", position: null }, error: "Reading progress could not be restored from this browser." };
    }
  });
  const [readingError, setReadingError] = useState(resume.error);
  const [generalPage, setGeneralPage] = useState(resume.page);
  const [favorites, setFavorites] = useState<{ surahs: number[]; error: string }>(() => {
    try { return { surahs: loadQuranFavoriteSurahs(profileKey), error: "" }; }
    catch (error) {
      console.warn("Unable to load favourite Surahs.", error);
      return { surahs: [], error: "Favourite Surahs could not be restored from this browser." };
    }
  });
  const favoriteNumber = Number(params.get("favorite"));
  const favoriteSurah = Number.isInteger(favoriteNumber) && favoriteNumber >= 1 && favoriteNumber <= 114 ? favoriteNumber : null;
  const completionPage = params.get("page") === "dua";
  const requested = Number(params.get("page") ?? resume.page);
  const pageNumber = completionPage ? 604 : Number.isInteger(requested) && requested >= 1 && requested <= 604 ? requested : 1;
  const readerPage: QuranReaderPageNumber = completionPage ? "dua" : pageNumber;
  const [settings, setSettings] = useState(() => loadSettings());
  const preferences = settings.quran;
  const [page, setPage] = useState<QuranPage | null>(null);
  const [directory, setDirectory] = useState<QuranDirectory | null>(null);
  const directoryReady = directory !== null;
  const [lineLayout, setLineLayout] = useState<{
    lines: QuranReadingLine[]; width: number; page: QuranPage | null; script: string; fontSize: number;
  }>({ lines: [], width: 0, page: null, script: "", fontSize: 0 });
  const lines = lineLayout.lines;
  const [glyphLayout, setGlyphLayout] = useState<{
    page: QuranPage | null; lines: QuranReadingLine[] | null; fontKey: string;
  }>({ page: null, lines: null, fontKey: "" });
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [fonts, setFonts] = useState({ key: "", error: "" });
  const [directoryError, setDirectoryError] = useState("");
  const [retry, setRetry] = useState(0);
  const requestKey = `${pageNumber}:${preferences.preferredTranslation}:${preferences.mushafLines}:${retry}:${favoriteSurah ?? "general"}`;
  const loading = !completionPage && loadedKey !== requestKey;
  const fontKey = `${preferences.arabicScript}:${preferences.preferredTranslation}:${retry}`;
  const fontsReady = fonts.key === fontKey && !fonts.error;
  const pageError = error || (fonts.key === fontKey ? fonts.error : "");
  const [drawer, setDrawer] = useState<"index" | "listen" | "options" | "more" | "tafseer" | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [jump, setJump] = useState(String(pageNumber));
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const searchPending = search !== deferredSearch;
  const [directorySection, setDirectorySection] = useState<"surahs" | "juzs" | "favorites">("surahs");
  const [activeVerse, setActiveVerse] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [tafseerKey, setTafseerKey] = useState("");
  const [tafseer, setTafseer] = useState<QuranTafseer | null>(null);
  const [tafseerError, setTafseerError] = useState("");
  const [tafseerRetry, setTafseerRetry] = useState(0);
  const [navigationError, setNavigationError] = useState("");
  const [navigationStatus, setNavigationStatus] = useState<{ label: string; page: number | null } | null>(null);
  const [offlineProgress, setOfflineProgress] = useState<QuranOfflineProgress | null>(null);
  const navigationPending = navigationStatus !== null;
  const [verseTarget, setVerseTarget] = useState<{ key: string; page: number } | null>(null);
  const [fitMode, setFitMode] = useState(resume.view.mode === "fit");
  const immersive = fitMode && mobileReader;
  const [controlsVisible, setControlsVisible] = useState(false);
  const controlsShown = !immersive || controlsVisible || !!drawer || !!modal ||
    !!pageError || !!readingError || !!audioError || !!navigationError;
  const controlsId = useId();
  const controlsToggle = useRef<HTMLButtonElement>(null);
  const [fitWidth, setFitWidth] = useState(720);
  const [fitAspectRatio, setFitAspectRatio] = useState(QURAN_PAGE_ASPECT_RATIO);
  const [pageZoom, setPageZoom] = useState(1);
  const [browserZoomed, setBrowserZoomed] = useState(false);
  const fittingPreferences = `${preferences.arabicScript}:${preferences.arabicFontSize}:${preferences.translationFontSize}:${preferences.showTranslation}`;
  const [pageFit, setPageFit] = useState<{
    page: QuranPage | null; lines: QuranReadingLine[] | null; width: number; height: number; scale: number; aspectRatio: number; preferences: string;
  }>({ page: null, lines: null, width: 0, height: 0, scale: 0, aspectRatio: 0, preferences: "" });
  const probe = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const bufferedAudio = useRef<HTMLAudioElement>(null);
  const lookaheadAudio = useRef<HTMLAudioElement>(null);
  const recitation = useRef<QuranAudioPlayer | null>(null);
  const playbackIntent = useRef(false);
  const pageTransition = useRef<HTMLDivElement>(null);
  const transitionTimeout = useRef(0);
  const retainedPage = useRef<ReturnType<typeof captureReadingPage> | null>(null);
  const pagePrefetch = useRef<AbortController | null>(null);
  const [hasPresentedPage, setHasPresentedPage] = useState(false);
  const frame = useRef<HTMLElement>(null);
  const navigationRequest = useRef<AbortController | null>(null);
  const directoryResults = useRef<HTMLDivElement>(null);
  const scrolledTarget = useRef<typeof verseTarget>(null);
  const readingViewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const fitSizing = useRef({ key: "", attempts: 0, fittingWidth: 0, widths: new Set<number>() });
  const gesture = useRef<{ x: number; y: number; time: number } | null>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const pinch = useRef<{ distance: number; zoom: number; x: number; y: number } | null>(null);
  const zoomAnimation = useRef(0);
  const suppressClickUntil = useRef(0);
  const layoutReady = fontsReady && (directoryReady || !!directoryError) &&
    lineLayout.page === page && lineLayout.script === preferences.arabicScript &&
    lineLayout.fontSize === preferences.arabicFontSize && lines.length > 0;
  const fitReady = pageFit.page === page && pageFit.lines === lines && pageFit.width === fitWidth &&
    pageFit.aspectRatio === fitAspectRatio && pageFit.preferences === fittingPreferences && pageFit.scale > 0;
  const glyphsReady = glyphLayout.page === page && glyphLayout.lines === lines && glyphLayout.fontKey === fontKey;
  const pageReady = completionPage || (!loading && !pageError && layoutReady && glyphsReady && (!fitMode || fitReady));
  const firstReadingVerse = completionPage ? undefined : page?.lines[0]?.segments[0]?.verseKey;
  const activeVerseLabel = activeVerse === "1:6" ? "Ayahs 1:6–7" : `Ayah ${activeVerse}`;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 900px)");
    const sync = () => setMobileReader(media.matches);
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
      cancelAnimationFrame(zoomAnimation.current);
      clearTimeout(transitionTimeout.current);
    };
  }, []);

  useEffect(() => {
    if (!immersive || !controlsVisible || drawer || modal) return;
    const timeout = window.setTimeout(() => {
      if (frame.current?.querySelector(".home-view-header :focus-visible, .quran-controls :focus-visible")) return;
      setControlsVisible(false);
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [immersive, controlsVisible, drawer, modal]);

  useEffect(() => {
    if (!params.has("page")) {
      const next = new URLSearchParams(params);
      next.set("page", String(pageNumber));
      setParams(next, { replace: true });
    }
  }, [params, pageNumber, setParams]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => setBrowserZoomed(viewport.scale > 1.02);
    const animation = requestAnimationFrame(sync);
    viewport.addEventListener("resize", sync);
    return () => { cancelAnimationFrame(animation); viewport.removeEventListener("resize", sync); };
  }, []);

  const rememberReadingPosition = useEffectEvent(() => {
    const snapshot = retainedPage.current, sheet = paper.current, viewport = readingViewport.current;
    if (!pageReady || !snapshot || !sheet || !viewport) return;
    const bounds = viewport.getBoundingClientRect(), position = sheet.getBoundingClientRect();
    Object.assign(snapshot.bounds, { left: `${bounds.left}px`, top: `${bounds.top}px`,
      width: `${bounds.width}px`, height: `${bounds.height}px` });
    Object.assign(snapshot.copy.style, { left: `${position.left - bounds.left}px`,
      top: `${position.top - bounds.top}px` });
  });
  useEffect(() => {
    const sync = () => rememberReadingPosition();
    window.addEventListener("scroll", sync, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", sync, true);
  }, []);

  useEffect(() => {
    if (directoryResults.current) directoryResults.current.scrollTop = 0;
  }, [search, directorySection]);

  useEffect(() => {
    const sync = () => {
      setSettings(loadSettings());
      try { setFavorites({ surahs: loadQuranFavoriteSurahs(profileKey), error: "" }); }
      catch (error) {
        console.warn("Unable to reload favourite Surahs.", error);
        setFavorites(previous => ({ ...previous, error: "Favourite Surahs could not be loaded. Check browser storage." }));
      }
    };
    window.addEventListener("ic:settingsUpdated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ic:settingsUpdated", sync);
      window.removeEventListener("storage", sync);
      navigationRequest.current?.abort();
    };
  }, [profileKey]);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setJump(String(pageNumber)));
    return () => cancelAnimationFrame(animation);
  }, [pageNumber]);

  useEffect(() => {
    const controller = new AbortController();
    getQuranDirectory(controller.signal).then(setDirectory).catch(error => {
      if (!controller.signal.aborted) setDirectoryError(errorMessage(error, "Unable to load the directory."));
    });
    return () => controller.abort();
  }, [retry]);

  useEffect(() => {
    const prepare = () => {
      void prepareQuranOffline(preferences.preferredTranslation, preferences.mushafLines)
        .catch((error: unknown) => console.warn("Quran offline download paused and will resume later.", error));
    };
    const unsubscribe = subscribeQuranOfflineProgress(progress => {
      if (progress.translation === preferences.preferredTranslation && progress.lines === preferences.mushafLines)
        setOfflineProgress(progress);
    });
    const offline = () => setOfflineProgress(previous => previous ? {
      ...previous, state: previous.state === "ready" ? "ready" : "paused",
    } : null);
    prepare();
    window.addEventListener("online", prepare);
    window.addEventListener("offline", offline);
    return () => {
      unsubscribe();
      window.removeEventListener("online", prepare);
      window.removeEventListener("offline", offline);
    };
  }, [preferences.preferredTranslation, preferences.mushafLines]);

  useEffect(() => {
    let disposed = false;
    const families = [
      preferences.arabicScript === "indopak" ? "Digital Khatt IndoPak" : "Amiri Quran",
      ...(preferences.arabicScript === "indopak" ? ["IndopakNastaleeq"] : []),
      preferences.preferredTranslation.endsWith("-ur") ? "Jameel Noori Nastaleeq Regular" : "Inter",
      "Surah Name Color V4", "Juz Name", "Surah Name V2", "QPC V2 Bismillah",
    ];
    void Promise.all(families.map(family => document.fonts.load(`32px "${family}"`)))
      .then(() => document.fonts.ready)
      .then(() => { if (!disposed) setFonts({ key: fontKey, error: "" }); })
      .catch(error => {
        if (!disposed) setFonts({ key: fontKey,
          error: errorMessage(error, "Unable to load the Quran fonts. Please try again.") });
      });
    return () => { disposed = true; };
  }, [fontKey, preferences.arabicScript, preferences.preferredTranslation]);

  useEffect(() => {
    if (completionPage) return;
    const controller = new AbortController();
    getQuranPage(pageNumber, preferences.preferredTranslation, preferences.mushafLines, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setPage(data); setError("");
        try {
          if (!favoriteSurah) {
            saveQuranReadingPage(profileKey, data.pageNumber);
            setGeneralPage(data.pageNumber);
          }
          setReadingError("");
        } catch (error) {
          console.warn("Unable to save Quran reading progress.", error);
          setReadingError("Reading progress could not be saved. Enable site storage in this browser to resume later.");
        }
      })
      .catch(error => {
        if (!controller.signal.aborted) {
          setPage(null);
          setError(errorMessage(error, "Unable to load this Quran page."));
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoadedKey(requestKey); });
    return () => controller.abort();
  }, [pageNumber, completionPage, favoriteSurah, preferences.preferredTranslation, preferences.mushafLines, requestKey, profileKey]);

  useEffect(() => {
    const controller = new AbortController();
    pagePrefetch.current = controller;
    return () => controller.abort();
  }, [preferences.preferredTranslation, preferences.mushafLines, profileKey]);

  useEffect(() => {
    const controller = pagePrefetch.current;
    if (completionPage || loading || pageError || !page || !controller || controller.signal.aborted) return;
    for (const direction of [-1, 1] as const) {
      const adjacent = getAdjacentQuranPage(pageNumber, direction);
      for (const number of [adjacent, getAdjacentQuranPage(adjacent, direction)]) {
        void getQuranPage(number, preferences.preferredTranslation,
        preferences.mushafLines, controller.signal).catch(error => {
          if (!controller.signal.aborted) console.warn("Unable to preload a nearby Quran page.", error);
        });
      }
    }
  }, [pageNumber, completionPage, page, loading, pageError, preferences.preferredTranslation, preferences.mushafLines]);

  useLayoutEffect(() => {
    const surface = pageTransition.current;
    if (!surface) return;
    clearTimeout(transitionTimeout.current);
    if (completionPage || (pageError && !loading)) {
      retainedPage.current = null;
      surface.classList.remove("is-visible");
      surface.replaceChildren();
      return;
    }
    if (!pageReady) {
      if (retainedPage.current) showReadingPage(surface, retainedPage.current);
      return;
    }
    let revealFrame = 0;
    const captureFrame = requestAnimationFrame(() => {
      // Paint the complete incoming paper before revealing it beneath the retained page.
      revealFrame = requestAnimationFrame(() => {
        if (paper.current && readingViewport.current)
          retainedPage.current = captureReadingPage(paper.current, readingViewport.current);
        surface.classList.remove("is-visible");
        transitionTimeout.current = window.setTimeout(() => surface.replaceChildren(), 300);
      });
    });
    return () => {
      cancelAnimationFrame(captureFrame);
      cancelAnimationFrame(revealFrame);
      clearTimeout(transitionTimeout.current);
    };
  }, [pageReady, completionPage, pageError, loading, page, fitMode, fittingPreferences, fitWidth, lines, pageZoom]);

  useEffect(() => {
    const sheet = paper.current;
    if (!sheet || !layoutReady) return;
    const check = () => {
      if (sheet.querySelector('[data-quran-glyph-ready="false"]')) {
        setGlyphLayout(previous => previous.page === page && previous.lines === lines
          ? { page: null, lines: null, fontKey: "" } : previous);
        return;
      }
      setGlyphLayout(previous => previous.page === page && previous.lines === lines && previous.fontKey === fontKey
        ? previous : { page, lines, fontKey });
    };
    const observer = new MutationObserver(check);
    observer.observe(sheet, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-quran-glyph-ready"] });
    check();
    return () => observer.disconnect();
  }, [layoutReady, completionPage, page, lines, fontKey]);

  useEffect(() => {
    const element = probe.current;
    if (!element || !page || loading || !fontsReady) return;
    let disposed = false;
    let animation = 0;
    let measuredWidth = 0;
    const measurements = new Map<string, number>();
    const calculate = () => {
      if (disposed || !element.isConnected || element.clientWidth <= 0 || document.fonts.status === "loading") return;
      if (measuredWidth === element.clientWidth) return;
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const span = document.createElement("span");
      span.style.cssText = "display:inline-block;white-space:pre;";
      element.appendChild(span);
      const scale = paper.current ? paper.current.getBoundingClientRect().width / paper.current.offsetWidth : 1;
      const measure = (text: string) => {
        const cached = measurements.get(text);
        if (cached !== undefined) return cached;
        span.replaceChildren(...getQuranTextRuns(text, preferences.arabicScript).map(run => {
          if (!run.fallback) return document.createTextNode(run.text);
          const word = document.createElement("span");
          word.className = "quran-indopak-fallback";
          word.textContent = run.text;
          return word;
        }));
        const width = span.getBoundingClientRect().width / scale;
        measurements.set(text, width);
        return width;
      };
      const result = layoutQuranLines(page.lines, preferences.arabicScript, width, measure,
        Math.max(32, preferences.arabicFontSize) + 6);
      span.remove();
      measuredWidth = element.clientWidth;
      setLineLayout({ lines: result, width: element.clientWidth, page,
        script: preferences.arabicScript, fontSize: preferences.arabicFontSize });
    };
    const schedule = () => { cancelAnimationFrame(animation); animation = requestAnimationFrame(calculate); };
    const fontsChanged = () => { measurements.clear(); measuredWidth = 0; schedule(); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    calculate();
    void document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", fontsChanged);
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fontsChanged);
    };
  }, [page, completionPage, loading, fontsReady, preferences.arabicScript, preferences.arabicFontSize]);

  useEffect(() => {
    const viewport = readingViewport.current, sheet = paper.current;
    if (!fitMode || loading || !fontsReady || !glyphsReady || !lineLayout.lines.length || !viewport || !sheet) return;
    let disposed = false;
    let animation = 0;
    const calculate = () => {
      if (disposed || document.fonts.status === "loading" || viewport.offsetHeight <= 2 || viewport.offsetWidth <= 2 ||
        lineLayout.page !== page || lineLayout.script !== preferences.arabicScript ||
        lineLayout.fontSize !== preferences.arabicFontSize ||
        Math.abs((probe.current?.clientWidth ?? 0) - lineLayout.width) > 1) return;
      const width = sheet.offsetWidth, height = sheet.offsetHeight;
      const availableWidth = viewport.offsetWidth - 2, availableHeight = viewport.offsetHeight - 2;
      const aspectRatio = immersive ? Math.min(QURAN_PAGE_ASPECT_RATIO, availableWidth / availableHeight) : QURAN_PAGE_ASPECT_RATIO;
      if (Math.abs(aspectRatio - fitAspectRatio) > .0001) {
        setFitAspectRatio(aspectRatio);
        return;
      }
      const key = `${requestKey}:${availableWidth}:${availableHeight}:${aspectRatio}:${preferences.arabicScript}:${preferences.arabicFontSize}:${preferences.translationFontSize}:${preferences.showTranslation}:${document.fonts.status}`;
      if (fitSizing.current.key !== key)
        fitSizing.current = { key, attempts: 0, fittingWidth: 0, widths: new Set<number>() };
      fitSizing.current.widths.add(width);
      const fitsPortrait = height <= width / aspectRatio + 1;
      if (fitsPortrait && (!fitSizing.current.fittingWidth || width < fitSizing.current.fittingWidth))
        fitSizing.current.fittingWidth = width;
      const style = getComputedStyle(sheet);
      // Exclude the empty space reserved by the portrait paper's minimum height.
      const contentHeight = Array.from(sheet.querySelectorAll<HTMLElement>(":scope > *"))
        .reduce((total, child) => total + child.offsetHeight, 0) +
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + sheet.offsetHeight - sheet.clientHeight;
      // Keep well-filled paper instead of chasing tiny size gains; do not revisit oscillating row breaks.
      let balancedWidth = fitsPortrait && contentHeight >= height * .9 ? width
        : fitSizing.current.attempts < 6 ? getQuranPageWidth(width, contentHeight, aspectRatio)
        : fitsPortrait ? width : fitSizing.current.fittingWidth ||
          Math.min(3200, Math.ceil(contentHeight * aspectRatio / 8) * 8);
      if (balancedWidth !== width && fitSizing.current.widths.has(balancedWidth))
        balancedWidth = fitSizing.current.fittingWidth ||
          Math.min(3200, Math.ceil(contentHeight * aspectRatio / 8) * 8);
      if (balancedWidth !== width) {
        fitSizing.current.attempts++;
        setFitWidth(balancedWidth);
        return;
      }
      const scale = getQuranPageScale(width, height, availableWidth, availableHeight);
      setPageFit(previous => previous.page === page && previous.lines === lineLayout.lines && previous.width === width &&
        previous.height === height && previous.scale === scale && previous.aspectRatio === aspectRatio &&
        previous.preferences === fittingPreferences ? previous : {
          page, lines: lineLayout.lines, width, height, scale, aspectRatio, preferences: fittingPreferences,
        });
    };
    const schedule = () => { cancelAnimationFrame(animation); animation = requestAnimationFrame(calculate); };
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport); observer.observe(sheet);
    calculate();
    void document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    return () => {
      disposed = true; cancelAnimationFrame(animation); observer.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [fitMode, immersive, completionPage, fitAspectRatio, fittingPreferences, fitWidth, lineLayout, page, requestKey, loading, fontsReady, glyphsReady, preferences.arabicScript, preferences.arabicFontSize,
    preferences.showTranslation, preferences.translationFontSize]);

  useEffect(() => {
    if (completionPage || loading || error || !page || page.pageNumber !== pageNumber) return;
    try {
      saveQuranReaderView(profileKey, { mode: fitMode ? "fit" : "scroll", position: null });
    } catch (error) {
      console.warn("Unable to save Quran reading view.", error);
      const animation = requestAnimationFrame(() => setReadingError("Reading progress could not be saved. Enable site storage in this browser to resume later."));
      return () => cancelAnimationFrame(animation);
    }
  }, [fitMode, completionPage, page, pageNumber, loading, error, profileKey]);

  useEffect(() => {
    if (completionPage) recitation.current?.stop();
  }, [completionPage]);

  useEffect(() => {
    if (!navigationStatus) return;
    const destination = navigationStatus.page;
    const urlPage = Number(new URL(window.location.href).searchParams.get("page"));
    if (pageError || (destination !== null && (urlPage !== destination || (pageReady && pageNumber === destination)))) {
      const animation = requestAnimationFrame(() => setNavigationStatus(null));
      return () => cancelAnimationFrame(animation);
    }
  }, [navigationStatus, pageReady, pageNumber, pageError, params]);

  useEffect(() => {
    const cancel = () => {
      navigationRequest.current?.abort();
      setNavigationStatus(null);
    };
    window.addEventListener("popstate", cancel);
    return () => window.removeEventListener("popstate", cancel);
  }, []);

  useEffect(() => {
    if (!verseTarget || verseTarget.page !== pageNumber || loading || !layoutReady || scrolledTarget.current === verseTarget) return;
    if (fitMode && !fitReady) return;
    let disposed = false;
    let animation = 0;
    void document.fonts.ready.then(() => {
      animation = requestAnimationFrame(() => {
        if (disposed) return;
        const element = Array.from(paper.current?.querySelectorAll<HTMLElement>(".quran-verse") ?? [])
          .find(verse => verse.dataset.verseKey === verseTarget.key);
        if (!element) return;
        if (!fitMode || pageZoom > 1)
          element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        scrolledTarget.current = verseTarget;
      });
    });
    return () => { disposed = true; cancelAnimationFrame(animation); };
  }, [verseTarget, pageNumber, loading, layoutReady, lines, fitMode, fitReady, pageZoom]);

  const followRecitation = useEffectEvent((canonicalKey: string) => {
    const key = getReaderQuranVerse(canonicalKey);
    if (!key) return;
    if (!page?.lines.some(line => line.segments.some(segment => segment.verseKey === key))) void goToVerse(key, true);
    else if (fitMode) setVerseTarget({ key, page: pageNumber });
  });
  const nextRecitationVerse = useEffectEvent((key: string) =>
    directory ? getAdjacentQuranVerse(key, 1, directory.surahs) : null);
  const updateRecitationState = useEffectEvent((state: RecitationState) => {
    setActiveVerse(state.verseKey ? getReaderQuranVerse(state.verseKey) : null); setPlaying(state.playing);
    setAudioLoading(state.loading); setAudioError(state.error);
    if (immersive && state.playing && !playbackIntent.current) {
      setControlsVisible(false);
      setDrawer(null);
    }
    playbackIntent.current = state.playing;
  });

  useEffect(() => {
    if (!directoryReady || !audio.current || !bufferedAudio.current || !lookaheadAudio.current) return;
    const player = new QuranAudioPlayer([audio.current, bufferedAudio.current, lookaheadAudio.current], {
      source: async (key, reciter, signal) => {
        try { return await getQuranAudio(key, reciter, signal); }
        catch (error) { throw new Error(errorMessage(error, "Unable to load this recitation."), { cause: error }); }
      },
      next: key => nextRecitationVerse(key),
      onState: state => updateRecitationState(state),
      onVerse: key => followRecitation(key),
    });
    recitation.current = player;
    return () => { player.dispose(); recitation.current = null; };
  }, [directoryReady]);

  useEffect(() => { recitation.current?.setReciter(preferences.reciter); }, [preferences.reciter, directoryReady]);

  useEffect(() => {
    if (drawer !== "tafseer" || !tafseerKey) return;
    const controller = new AbortController();
    getQuranTafseer(tafseerKey, preferences.preferredTafseer, controller.signal).then(value => {
      if (!controller.signal.aborted) setTafseer(value);
    }).catch(error => {
      if (!controller.signal.aborted) setTafseerError(errorMessage(error, "Unable to load Tafseer."));
    });
    return () => controller.abort();
  }, [drawer, tafseerKey, preferences.preferredTafseer, tafseerRetry]);

  function updatePreferences(update: Partial<AppSettings["quran"]>) {
    if ((["arabicScript", "arabicFontSize", "translationFontSize", "showTranslation", "preferredTranslation", "mushafLines"] as const)
      .some(key => update[key] !== undefined && update[key] !== preferences[key])) preservePageForTransition();
    const next = { ...settings, quran: { ...settings.quran, ...update } };
    if (update.preferredTranslation || update.mushafLines) setError("");
    setSettings(next);
    saveSettings(next);
  }
  function preservePageForTransition(direction = 0) {
    const surface = pageTransition.current, sheet = paper.current, viewport = readingViewport.current;
    if (!surface || !sheet || !viewport || !pageReady) return;
    clearTimeout(transitionTimeout.current);
    retainedPage.current = captureReadingPage(sheet, viewport);
    showReadingPage(surface, retainedPage.current);
    setHasPresentedPage(true);
    frame.current?.style.setProperty("--quran-page-exit",
      direction > 0 ? "inset(0 0 0 100%)" : "inset(0 100% 0 0)");
  }
  function changePage(number: QuranReaderPageNumber, keepAudio = false,
    direction = number === "dua" || number > pageNumber ? 1 : -1, favorite?: number | null) {
    if ((number !== "dua" && (number < 1 || number > 604)) || (number === readerPage && favorite === undefined)) return;
    preservePageForTransition(direction);
    setNavigationStatus(null);
    if (!keepAudio) {
      navigationRequest.current?.abort();
      recitation.current?.stop();
    }
    setError(""); setVerseTarget(null);
    gesture.current = null; drag.current = null; pinch.current = null;
    cancelAnimationFrame(zoomAnimation.current);
    setDrawer(null);
    readingViewport.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setJump(String(number));
    const next = new URLSearchParams(params);
    next.set("page", String(number));
    if (favorite === null) next.delete("favorite");
    else if (favorite !== undefined) next.set("favorite", String(favorite));
    setParams(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function turnPage(delta: -1 | 1) {
    if (completionPage) { changePage(getAdjacentQuranReaderPage(readerPage, delta), false, delta); return; }
    if (!fitMode || !fitReady || loading || error || drawer || modal) return;
    changePage(getAdjacentQuranReaderPage(readerPage, delta), false, delta);
  }
  function openSurah(surah: QuranSurah) {
    changePage(surah.startPage, false, surah.startPage > pageNumber ? 1 : -1,
      directorySection === "favorites" ? surah.number : undefined);
    setNavigationStatus({ label: `Opening Surah ${surah.name}...`, page: surah.startPage });
    setDrawer(null);
  }
  function toggleFavorite(surah: QuranSurah) {
    try {
      const saved = loadQuranFavoriteSurahs(profileKey);
      const next = saved.includes(surah.number) ? saved.filter(number => number !== surah.number) : [...saved, surah.number];
      saveQuranFavoriteSurahs(profileKey, next);
      setFavorites({ surahs: next, error: "" });
    } catch (error) {
      console.warn("Unable to save favourite Surahs.", error);
      setFavorites(previous => ({ ...previous, error: "Favourite Surahs could not be saved. Check browser storage and try again." }));
    }
  }
  function resumeGeneralReading() {
    try {
      const number = loadQuranReadingPage(profileKey) ?? resume.page;
      changePage(number, false, number > pageNumber ? 1 : -1, null);
    } catch (error) {
      console.warn("Unable to restore general reading progress.", error);
      setReadingError("Your general reading page could not be restored. Check browser storage and try again.");
    }
  }
  function changeReadingMode(enabled: boolean) {
    scrolledTarget.current = null;
    setPageZoom(1);
    setControlsVisible(true);
    setFitMode(enabled);
  }
  function zoomPage(zoom: number, focal?: { x: number; y: number; clientX: number; clientY: number }) {
    const viewport = readingViewport.current;
    if (!viewport || !fitReady) return;
    const next = Math.max(1, Math.min(4, zoom));
    const oldMargin = Math.max(0, (viewport.clientWidth - pageFit.width * pageFit.scale * pageZoom) / 2);
    const newMargin = Math.max(0, (viewport.clientWidth - pageFit.width * pageFit.scale * next) / 2);
    const oldVerticalMargin = Math.max(0, (viewport.clientHeight - pageFit.height * pageFit.scale * pageZoom) / 2);
    const newVerticalMargin = Math.max(0, (viewport.clientHeight - pageFit.height * pageFit.scale * next) / 2);
    const x = focal?.x ?? (viewport.scrollLeft + viewport.clientWidth / 2 - oldMargin) / pageZoom;
    const y = focal?.y ?? (viewport.scrollTop + viewport.clientHeight / 2 - oldVerticalMargin) / pageZoom;
    setPageZoom(next);
    cancelAnimationFrame(zoomAnimation.current);
    zoomAnimation.current = requestAnimationFrame(() => viewport.scrollTo({
      left: next === 1 ? 0 : x * next + newMargin - (focal?.clientX ?? viewport.clientWidth / 2),
      top: next === 1 ? 0 : y * next + newVerticalMargin - (focal?.clientY ?? viewport.clientHeight / 2), behavior: "instant",
    }));
  }
  function startSwipe(event: TouchEvent<HTMLDivElement>) {
    gesture.current = null; drag.current = null; pinch.current = null;
    if (!fitMode || !fitReady || (window.visualViewport?.scale ?? 1) > 1.02 ||
      (event.target instanceof Element && event.target.closest("input, a, select, textarea"))) return;
    const viewport = event.currentTarget, bounds = viewport.getBoundingClientRect();
    if (event.touches.length === 2) {
      const first = event.touches[0], second = event.touches[1];
      const x = (first.clientX + second.clientX) / 2 - bounds.left;
      const y = (first.clientY + second.clientY) / 2 - bounds.top;
      pinch.current = {
        distance: Math.max(1, Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)), zoom: pageZoom,
        x: (viewport.scrollLeft + x - Math.max(0, (viewport.clientWidth - pageFit.width * pageFit.scale * pageZoom) / 2)) / pageZoom,
        y: (viewport.scrollTop + y - Math.max(0, (viewport.clientHeight - pageFit.height * pageFit.scale * pageZoom) / 2)) / pageZoom,
      };
      suppressClickUntil.current = Date.now() + 400;
      return;
    }
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const visualViewport = window.visualViewport;
    if (startsInSystemGestureZone(touch.clientX, touch.clientY, visualViewport ? {
      left: visualViewport.offsetLeft,
      top: visualViewport.offsetTop,
      width: visualViewport.width,
      height: visualViewport.height,
    } : {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    })) return;
    if (pageZoom > 1) {
      drag.current = { x: touch.clientX, y: touch.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      return;
    }
    gesture.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }
  function moveSwipe(event: TouchEvent<HTMLDivElement>) {
    if (pinch.current && event.touches.length === 2) {
      const first = event.touches[0], second = event.touches[1], bounds = event.currentTarget.getBoundingClientRect();
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
      zoomPage(pinch.current.zoom * distance / pinch.current.distance, {
        x: pinch.current.x, y: pinch.current.y,
        clientX: (first.clientX + second.clientX) / 2 - bounds.left,
        clientY: (first.clientY + second.clientY) / 2 - bounds.top,
      });
      suppressClickUntil.current = Date.now() + 400;
    } else if (event.touches.length === 1) {
      const touch = event.touches[0], start = drag.current ?? gesture.current;
      if (start && Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 6)
        suppressClickUntil.current = Date.now() + 400;
      if (drag.current) event.currentTarget.scrollTo({
        left: drag.current.left - (touch.clientX - drag.current.x),
        top: drag.current.top - (touch.clientY - drag.current.y), behavior: "instant",
      });
    } else {
      gesture.current = null; drag.current = null; pinch.current = null;
    }
  }
  function endSwipe(event: TouchEvent<HTMLDivElement>) {
    if (pinch.current || drag.current) {
      const touch = event.changedTouches[0];
      if (pinch.current || (drag.current && touch &&
        Math.hypot(touch.clientX - drag.current.x, touch.clientY - drag.current.y) > 6))
        suppressClickUntil.current = Date.now() + 400;
      gesture.current = null; pinch.current = null; drag.current = null;
      if (event.touches.length === 1 && pageZoom > 1) {
        const touch = event.touches[0];
        drag.current = { x: touch.clientX, y: touch.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
      }
      return;
    }
    const start = gesture.current;
    gesture.current = null;
    if (!start || pageZoom > 1 || (window.visualViewport?.scale ?? 1) > 1.02 ||
      event.touches.length || !event.changedTouches.length || window.getSelection()?.toString()) return;
    const touch = event.changedTouches[0];
    const delta = getQuranSwipeDirection(touch.clientX - start.x, touch.clientY - start.y, Date.now() - start.time);
    if (delta) {
      suppressClickUntil.current = Date.now() + 400;
      turnPage(delta);
    }
  }
  async function goToVerse(key: string, keepAudio = false, label = `Opening Ayah ${key}...`) {
    navigationRequest.current?.abort();
    const controller = new AbortController();
    navigationRequest.current = controller;
    setNavigationError(""); setNavigationStatus({ label, page: null });
    try {
      const number = await getVersePage(key, controller.signal);
      if (!controller.signal.aborted) {
        changePage(number, keepAudio);
        setNavigationStatus({ label, page: number });
        setVerseTarget({ key, page: number });
        setDrawer(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setNavigationError(errorMessage(error, "Unable to navigate to this Ayah."));
        setNavigationStatus(null);
      }
    }
  }
  function updateDirectorySearch(value: string) {
    navigationRequest.current?.abort();
    setNavigationStatus(null); setNavigationError(""); setSearch(value);
  }
  function closeDrawer() {
    if (drawer === "index") {
      navigationRequest.current?.abort();
      setNavigationStatus(null);
    }
    setDrawer(null);
    setControlsVisible(true);
  }
  function searchAyah() {
    const key = parseAyahReference(search);
    if (!key) { setNavigationError("Enter an Ayah as Surah:Ayah, for example 33:56."); return; }
    const [surah, ayah] = key.split(":").map(Number);
    const chapter = directory?.surahs.find(item => item.number === surah);
    if (surah < 1 || surah > 114 || ayah < 1 || (chapter && ayah > chapter.ayahCount)) {
      setNavigationError(chapter
        ? `Surah ${surah} has ${chapter.ayahCount} Ayahs. Choose an Ayah from 1 to ${chapter.ayahCount}.`
        : "Choose a Surah from 1 to 114 and a valid Ayah number.");
      return;
    }
    void goToVerse(key);
  }
  function recite(key: string) {
    recitation.current?.toggle(getCanonicalQuranVerse(key));
  }
  function toggleRecitation() {
    const key = activeVerse ?? firstReadingVerse;
    if (key) recite(key);
  }
  function adjacentVerse(delta: -1 | 1) {
    const key = activeVerse ?? firstReadingVerse;
    if (!key || !directory) return;
    const next = getAdjacentQuranVerse(getCanonicalQuranVerse(key), delta, directory.surahs);
    if (next && next !== "1:1") recitation.current?.play(next);
    else recitation.current?.stop();
  }
  function openTafseer(key: string) {
    setTafseerKey(key); setTafseer(null); setTafseerError(""); setTafseerRetry(value => value + 1); setDrawer("tafseer");
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await frame.current?.requestFullscreen();
    } catch (error) { setNavigationError(errorMessage(error, "Fullscreen is not supported in this browser.")); }
  }
  const currentSurah = directory?.surahs.find(surah => surah.number === page?.lines[0]?.segments[0]?.surahNumber);
  const arabicClass = preferences.arabicScript === "indopak" ? "font-indopak" : "font-uthmani";
  const arabicStyle = { fontSize: `${preferences.arabicFontSize}px`,
    lineHeight: `${preferences.arabicFontSize * getQuranLineHeightMultiplier(preferences.arabicScript, fitMode)}px` };
  const searchTerm = normalizeQuranSearch(search);
  const deferredSearchTerm = normalizeQuranSearch(deferredSearch);
  const isAyahSearch = searchTerm.includes(":");
  const ayahReference = parseAyahReference(search);
  const matchesDirectorySearch = (number: number, name: string) => /^\d+$/.test(deferredSearchTerm)
    ? number === Number(deferredSearchTerm) : normalizeQuranSearch(name).includes(deferredSearchTerm);
  const matchingSurahs = directory?.surahs.filter(surah => (directorySection !== "favorites" || favorites.surahs.includes(surah.number)) &&
    matchesDirectorySearch(surah.number,
    `${surah.name} ${surah.nameArabic} Surah ${surah.number}`)) ?? [];
  const matchingJuzs = directory?.juzs.filter(juz => matchesDirectorySearch(juz.number,
    `${juz.nameArabic} Juz ${juz.number} Para ${juz.number}`)) ?? [];
  const directoryCount = directorySection === "juzs" ? matchingJuzs.length : matchingSurahs.length;
  const translationFontSize = preferences.translationFontSize;
  const readerError = (drawer !== "index" && navigationError) || (drawer !== "listen" && audioError);
  const offlineLabel = offlineProgress?.state === "ready"
    ? navigator.onLine ? "Quran ready offline" : "Reading offline"
    : offlineProgress?.state === "downloading"
      ? `Preparing offline Quran · ${Math.round(offlineProgress.completed / offlineProgress.total * 100)}%`
      : offlineProgress?.state === "paused"
        ? "Connect to finish offline setup"
        : offlineProgress?.state === "error"
          ? "Offline setup will retry"
          : offlineProgress?.state === "unsupported" ? "Offline reading unavailable" : "";
  const drawerDetails = drawer && {
    index: { title: "Browse Quran", description: "Find a Surah, Para or specific Ayah.", icon: <BookOpen size={20} /> },
    listen: { title: "Listen", description: "Choose a reciter and control your recitation.", icon: <Headphones size={20} /> },
    options: { title: "Reader options", description: "Adjust the reading view, text and translation.", icon: <Settings2 size={20} /> },
    more: { title: "More controls", description: "Jump to a page or open additional settings.", icon: <MoreHorizontal size={20} /> },
    tafseer: { title: `Tafseer · ${tafseerKey}`, description: "Sirat-ul-Jinan · Mufti Muhammad Qasim Attari", icon: <BookOpen size={20} /> },
  }[drawer];

  return (
    <div className="home-page">
      {!fitMode && <TopNav activeView="quran" onViewChange={view => {
        if (view === "quran") return;
        if (view === "dashboard" || view === "prayer") navigate(view === "prayer" ? "/?view=prayer" : "/");
        else setModal(view);
      }} onLogout={() => { logout(); navigate("/"); }} onSettingsClick={() => navigate("/settings")} />}
      <main className={`quran-reader ${fitMode ? "quran-reader--fit" : ""}${immersive ? " quran-reader--immersive" : ""}${!controlsShown ? " quran-reader--controls-hidden" : ""}`} ref={frame}>
        <header className={`home-view-header${favoriteSurah ? " quran-reader-header--favorite" : ""}`} inert={!controlsShown}>
          <Link className="home-back-btn" to="/" aria-label="Back to dashboard"><ArrowLeft size={20} /></Link>
          <div><span className="home-eyebrow">Read & reflect</span><h1>Qur&apos;an Reader</h1></div>
          <span className="quran-reader-location">{completionPage ? "Completion duas" : <>Page <strong>{pageNumber}</strong> / 604</>}</span>
          {offlineLabel && <span className={`quran-offline-status is-${offlineProgress?.state}`} role="status" aria-live="polite">
            {offlineProgress?.state === "ready" ? <CheckCircle2 size={16} /> :
              offlineProgress?.state === "paused" ? <WifiOff size={16} /> : <Download size={16} />}
            {offlineLabel}
          </span>}
          {immersive && <button type="button" className="quran-icon-button" aria-label="Hide reader controls"
            disabled={!!pageError || !!readingError || !!audioError || !!navigationError}
            onClick={() => {
              setControlsVisible(false);
              requestAnimationFrame(() => controlsToggle.current?.focus({ preventScroll: true }));
            }}><X size={18} /></button>}
          {favoriteSurah && <div className="quran-favorite-reading">
            <span><Star size={15} fill="currentColor" /> Favourite reading · General page {generalPage} saved</span>
            <button type="button" onClick={resumeGeneralReading}>Resume general reading</button>
          </div>}
        </header>
        {readerError && <p className="quran-error" role="alert">{readerError}</p>}
        {readingError && <p className="quran-error" role="alert">{readingError}</p>}
        {favorites.error && drawer !== "index" && <p className="quran-error" role="alert">{favorites.error}</p>}
        {navigationPending && drawer !== "index" && <p className="quran-navigation-status" role="status">
          <LoaderCircle className="quran-spinner" size={20} />{navigationStatus.label}
        </p>}
        {completionPage ? <QuranCompletionPage fontSize={preferences.arabicFontSize} script={preferences.arabicScript}
          fitMode={fitMode} onTurn={turnPage} onToggleControls={immersive ? () => setControlsVisible(value => !value) : undefined} />
          : pageError && !loading ? <div className="quran-error" role="alert">{pageError} <button type="button" onClick={() => {
            setRetry(value => value + 1);
          }}>Try again</button> <Link to="/settings">Settings</Link></div>
          : (
            <div className="quran-reading-viewport" ref={readingViewport} tabIndex={fitMode ? 0 : undefined}
                role={fitMode ? "region" : undefined} aria-label={fitMode ? "Whole Quran page" : undefined}
                aria-busy={!pageReady}
                style={fitMode ? { touchAction: browserZoomed ? "pan-x pan-y pinch-zoom" : "none" } : undefined}
                onTouchStart={startSwipe} onTouchEnd={endSwipe}
                onTouchMove={moveSwipe}
                onTouchCancel={() => { gesture.current = null; drag.current = null; pinch.current = null; }}
                onClickCapture={event => {
                  if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
                  else if (immersive && !controlsShown) {
                    event.preventDefault(); event.stopPropagation(); setControlsVisible(true);
                  }
                }}
                onClick={event => {
                  if (immersive && !(event.target instanceof Element && event.target.closest("button, a, [role='button']")))
                    setControlsVisible(false);
                }}
                onKeyDown={event => {
                  if (!fitMode || pageZoom > 1 || (window.visualViewport?.scale ?? 1) > 1.02 ||
                    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault(); turnPage(event.key === "ArrowRight" ? 1 : -1);
                  }
                }}>
              {!pageReady && <span className="quran-loading-announcement" role="status">Preparing Quran page</span>}
              <div className={`quran-page-stage${hasPresentedPage ? "" : " quran-page-stage--opening"}`}
                onAnimationEnd={event => {
                  if (event.target === event.currentTarget && event.animationName === "quran-page-open")
                    setHasPresentedPage(true);
                }} style={fitMode ? {
                width: pageFit.width * pageFit.scale * pageZoom,
                height: pageFit.height * pageFit.scale * pageZoom,
              } : undefined}>
              {page && <article ref={paper} className={`quran-page ${arabicClass} ${pageNumber <= 2 ? "quran-page--opening" : ""}`}
                inert={!pageReady}
                style={{ fontSize: `${preferences.arabicFontSize}px`, visibility: !pageReady ? "hidden" : undefined, ...(fitMode ? {
                  width: fitWidth, minHeight: fitWidth / fitAspectRatio,
                  transform: `scale(${fitReady ? pageFit.scale * pageZoom : 1})`,
                } : {}) }}>
              <header className="quran-page-margin" dir="rtl" lang="ar">
                <span className="quran-margin-label">{currentSurah && <>
                  <QuranNumber value={currentSurah.number} script={preferences.arabicScript} />
                  <QuranGlyph text={SURAH_COLOR_GLYPHS[currentSurah.number - 1]} script="surah-name-color-v4"
                    className="quran-margin-surah" label={`سُورَةُ ${currentSurah.nameArabic}`} />
                </>}</span>
                <span><QuranNumber value={pageNumber} script={preferences.arabicScript} /> / <span className="quran-latin-number">{pageNumber}</span></span>
                <span className="quran-margin-label">
                  <QuranNumber value={page.juzNumber} script={preferences.arabicScript} />
                  <QuranGlyph text={`j${String(page.juzNumber).padStart(3, "0")}`} script="juz-name"
                    className="quran-margin-juz" label={page.juzNameArabic} />
                </span>
              </header>
              <div className={`quran-arabic-stream quran-layout-probe ${arabicClass}`}
                style={arabicStyle} ref={probe} aria-hidden="true" />
              <div className="quran-reading-content">
              {lines.map((line, index) => (
                <div className="quran-reading-block" data-line-index={index} key={line.lineNumber}>
                  {line.surahHeaderBeforeLine && <SurahBanner surah={line.surahHeaderBeforeLine} page={page} settings={preferences} />}
                  <div className={`quran-register ${line.isSectionEnd ? "quran-register--section-end" : ""}`}>
                    <div className={`quran-arabic-stream ${arabicClass}${line.isJuzStart ? " quran-arabic-stream--para-start" : ""}`} dir="rtl" lang="ar" style={arabicStyle}>
                      {line.isJuzStart && <><span className="quran-para-start" role="img"
                        aria-label={`Start of Para ${page.juzNumber}`}>&#x06DE;</span>{"\u202F"}</>}
                      {line.segments.map((segment, index) => (
                        <Fragment key={`${segment.verseKey}-${index}`}>
                          {index > 0 && " "}
                          <span className={`quran-verse ${activeVerse && getCanonicalQuranVerse(activeVerse) === getCanonicalQuranVerse(segment.verseKey) ? "is-reciting" : ""} ${segment.isSajdah ? "is-sajdah" : ""} ${verseTarget?.page === pageNumber && verseTarget.key === segment.verseKey ? "is-targeted" : ""}`}
                            data-verse-key={segment.verseKey}
                            role="button" tabIndex={0} aria-label={`Recite Ayah ${segment.verseKey}`}
                            onClick={() => recite(segment.verseKey)}
                            onKeyDown={event => {
                              if (event.key === "Enter" || event.key === " ") { event.preventDefault(); recite(segment.verseKey); }
                            }}><QuranText text={segment.text} script={preferences.arabicScript} /></span>
                          {segment.endsAyah && "\u2060"}
                          <AyahMarkers segment={segment} settings={preferences} onOpen={openTafseer} />
                        </Fragment>
                      ))}
                    </div>
                    {preferences.showTranslation && line.translation && <p className="quran-line-translation" lang={page.translationLanguage}
                      dir={page.translationLanguage === "ur" ? "rtl" : "ltr"}
                      style={{ fontSize: `${translationFontSize}px` }}>
                      <TranslationText text={line.translation} script={preferences.arabicScript} />
                    </p>}
                    {line.segments.filter(segment => segment.isRukuEnd).map(segment => (
                      <RukuMark key={segment.verseKey} segment={segment} script={preferences.arabicScript} juz={page.juzNumber} />
                    ))}
                  </div>
                </div>
              ))}
              </div>
              <footer className="quran-page-footer" lang="ar">مَنْزِل <QuranNumber value={page.manzilNumber} script={preferences.arabicScript} /></footer>
              </article>}
              </div>
              </div>
          )}
        <div ref={pageTransition} className="quran-page-transition" aria-hidden="true" inert />
        {immersive && !controlsShown && <button ref={controlsToggle} type="button" className="quran-controls-toggle"
          aria-label="Show reader controls" aria-expanded={false} aria-controls={controlsId}
          onClick={event => {
            setControlsVisible(true);
            if (event.detail === 0) requestAnimationFrame(() =>
              frame.current?.querySelector<HTMLButtonElement>(".quran-controls button:not(:disabled)")?.focus());
          }}><MoreHorizontal size={22} /></button>}
        <div id={controlsId} className="quran-controls" inert={!controlsShown}>
          <nav className="quran-page-navigation" aria-label="Page navigation and zoom">
            <button type="button" aria-label="Previous page" disabled={!pageReady}
              onClick={() => changePage(getAdjacentQuranReaderPage(readerPage, -1), false, -1)}><ChevronLeft size={20} /></button>
            {completionPage ? <div className="quran-dock-position"><strong>Completion duas</strong><small>After page 604 · Next: Al-Fatihah</small></div>
              : fitMode ? <div className="quran-page-zoom">
              {pageZoom > 1 && <button type="button" aria-label="Zoom out" disabled={!fitReady}
                onClick={() => zoomPage(pageZoom - .5)}><ZoomOut size={20} /></button>}
              <button type="button" className="quran-fit-reset" aria-label="Fit whole page" disabled={!fitReady}
                onClick={() => zoomPage(1)}>{pageZoom === 1 ? "Fit page" : `${Math.round(pageZoom * 100)}%`}</button>
              <button type="button" aria-label="Zoom in" disabled={!fitReady || pageZoom >= 4}
                onClick={() => zoomPage(pageZoom + .5)}><ZoomIn size={20} /></button>
            </div> : <div className="quran-dock-position">
              <strong>Page {pageNumber} <span>/ 604</span></strong>
              <small>{currentSurah ? `${currentSurah.name} · Para ${page?.juzNumber}` : "Quran reader"}</small>
            </div>}
            <button type="button" aria-label="Next page" disabled={!pageReady}
              onClick={() => changePage(getAdjacentQuranReaderPage(readerPage, 1), false, 1)}><ChevronRight size={20} /></button>
          </nav>
          <nav className={`quran-toolbar${activeVerse ? " quran-toolbar--reciting" : ""}`} aria-label="Reader controls">
            {activeVerse && <button type="button" className="quran-playback-toggle"
              aria-label={playing ? "Pause recitation" : "Play recitation"} title={activeVerseLabel}
              disabled={completionPage || !directory || (!activeVerse && (loading || !page || !!error))} onClick={toggleRecitation}>
              {audioLoading ? <LoaderCircle className="quran-spinner" size={19} /> : playing ? <Pause size={19} /> : <Play size={19} />}
              <span>{playing ? "Pause" : audioLoading ? "Loading" : "Resume"}</span>
            </button>}
            <button type="button" aria-label="Surah and Juz directory" aria-haspopup="dialog" aria-expanded={drawer === "index"} onClick={() => {
              updateDirectorySearch(""); setDrawer("index");
            }}><BookOpen size={19} /><span>Browse</span></button>
            <button type="button" aria-label="Reciter settings" aria-haspopup="dialog" aria-expanded={drawer === "listen"}
              disabled={completionPage}
              className={playing ? "is-playing" : undefined} onClick={() => setDrawer("listen")}>
              <Headphones size={19} /><span>Listen</span></button>
            <button type="button" aria-label="Reader options" aria-haspopup="dialog" aria-expanded={drawer === "options"}
              onClick={() => setDrawer("options")}><Settings2 size={19} /><span>Display</span></button>
            <button type="button" aria-label="More reader controls" aria-haspopup="dialog" aria-expanded={drawer === "more"}
              onClick={() => setDrawer("more")}><MoreHorizontal size={19} /><span>More</span></button>
          </nav>
          {fitMode && !completionPage && <p className="quran-dock-hint">{browserZoomed ? "Drag to read · Pinch back to zoom out" : pageZoom > 1
            ? "Drag with one finger · Zoom out or fit page" : "Pinch to zoom · Swipe right for next · Tap for controls"}</p>}
        </div>
        <audio ref={audio} preload="auto" />
        <audio ref={bufferedAudio} preload="auto" />
        <audio ref={lookaheadAudio} preload="auto" />
      {drawer && drawerDetails && <ReaderDrawer {...drawerDetails}
        className={drawer === "index" ? "quran-directory-drawer" : ""} onClose={closeDrawer}>
        {drawer === "index" && <>
          {directoryError && <p className="quran-error" role="alert">{directoryError}<button onClick={() => {
            setDirectoryError(""); setRetry(value => value + 1);
          }}>Try again</button></p>}
          {!directory && !directoryError && <p className="quran-directory-loading" role="status">
            <LoaderCircle className="quran-spinner" size={18} />Loading directory…
          </p>}
          {favorites.error && <p className="quran-error" role="alert">{favorites.error}</p>}
          <div className="quran-directory-switch" role="group" aria-label="Browse Quran by">
            <button type="button" aria-pressed={directorySection === "surahs"} onClick={() => {
              setDirectorySection("surahs"); updateDirectorySearch("");
            }}>Surahs <span>114</span></button>
            <button type="button" aria-pressed={directorySection === "juzs"} onClick={() => {
              setDirectorySection("juzs"); updateDirectorySearch("");
            }}>Juz / Para <span>30</span></button>
            <button type="button" aria-pressed={directorySection === "favorites"} onClick={() => {
              setDirectorySection("favorites"); updateDirectorySearch("");
            }}>Favourites <span>{favorites.surahs.length}</span></button>
          </div>
          <form className="quran-directory-search" onSubmit={event => {
            event.preventDefault();
            if (navigationPending || searchPending) return;
            if (isAyahSearch) searchAyah();
            else if (directoryCount === 1) {
              if (directorySection === "juzs") {
                const juz = matchingJuzs[0];
                void goToVerse(juz.verseKey, false, `Opening Para ${juz.number}...`);
              } else openSurah(matchingSurahs[0]);
            } else setNavigationError("Choose a Surah or Para from the search results.");
          }}>
            <input className="quran-search" type="search"
              aria-label={directorySection === "juzs" ? "Search Juz, Para or Ayah" : "Search Surahs or Ayah"}
              placeholder="Name, number, or 33:56" value={search} onChange={event => updateDirectorySearch(event.target.value)} />
            <button type="submit" aria-label={isAyahSearch ? "Go to Ayah" : "Open search result"}
              disabled={!search.trim() || navigationPending || searchPending}>
              {navigationPending || searchPending ? <LoaderCircle className="quran-spinner" size={18} /> : "Go"}
            </button>
          </form>
          {navigationError && <p className="quran-error" role="alert">{navigationError}</p>}
          {(navigationPending || searchPending) && <p className="quran-directory-loading" role="status">
            <LoaderCircle className="quran-spinner" size={18} />{navigationStatus?.label ?? "Searching..."}
          </p>}
          {!isAyahSearch && directory && !searchPending && <p className="quran-directory-count" role="status">
            {directoryCount ? `${directoryCount} ${directorySection === "juzs" ? "Juz / Para" : "Surahs"}`
              : directorySection === "favorites" && !favorites.surahs.length
                ? "No favourite Surahs yet. Use the stars in the Surah list to add some." : "No matches. Try another name or number."}
          </p>}
          <div className="quran-directory-results" ref={directoryResults} role="region"
            aria-busy={navigationPending || searchPending}
            aria-label={directorySection === "juzs" ? "Juz and Para results" : directorySection === "favorites" ? "Favourite Surah results" : "Surah results"}>
            {isAyahSearch ? <p className="quran-directory-count">
              {ayahReference ? `Press Go or Enter to open Ayah ${ayahReference}.` : "Use Surah:Ayah, for example 33:56."}
            </p> :
            <div className={`quran-index ${directorySection === "juzs" ? "quran-index--juz" : ""}`}>
              {directorySection !== "juzs" ? matchingSurahs.map(surah => (
                <div className="quran-surah-row" key={surah.number}>
                <button type="button" disabled={navigationPending || searchPending}
                  aria-current={!completionPage && surah.number === currentSurah?.number ? "true" : undefined}
                  onClick={() => openSurah(surah)}>
                  <span className="quran-index-number">{surah.number}</span>
                  <span className="quran-index-name"><strong>{surah.name}</strong><small>{surah.ayahCount} Ayahs · Page {surah.startPage}</small></span>
                  <span lang="ar">{surah.nameArabic}</span>
                </button>
                <button type="button" className="quran-favorite-toggle"
                  aria-label={`${favorites.surahs.includes(surah.number) ? "Remove" : "Add"} ${surah.name} ${favorites.surahs.includes(surah.number) ? "from" : "to"} favourites`}
                  aria-pressed={favorites.surahs.includes(surah.number)} onClick={() => toggleFavorite(surah)}>
                  <Star size={20} fill={favorites.surahs.includes(surah.number) ? "currentColor" : "none"} />
                </button>
                </div>
              )) : matchingJuzs.map(juz => (
                <button type="button" key={juz.number} disabled={navigationPending || searchPending}
                  aria-current={!completionPage && juz.number === page?.juzNumber ? "true" : undefined}
                  onClick={() => void goToVerse(juz.verseKey, false, `Opening Para ${juz.number}...`)}>
                  <span className="quran-index-name"><strong>Para {juz.number}</strong></span><span lang="ar">{juz.nameArabic}</span>
                </button>
              ))}
            </div>}
          </div>
        </>}
        {drawer === "listen" && <div className="quran-options">
          <section className="quran-menu-section">
            <div className="quran-menu-field"><span>Reciter</span>
              <CustomDropdown label="Reciter" value={preferences.reciter} options={RECITERS_OPTIONS}
                onChange={reciter => updatePreferences({ reciter })} /></div>
          </section>
          <section className="quran-menu-section">
            <div className="quran-section-heading"><h3>Recitation</h3>
              <span>{activeVerse ? activeVerseLabel : `Page ${pageNumber}`}</span></div>
            <div className="quran-audio-controls">
              <button className="quran-icon-button" type="button" aria-label="Previous Ayah" disabled={completionPage || !directory || loading || !page || !!error}
                onClick={() => adjacentVerse(-1)}><SkipBack size={20} /></button>
              <button className="quran-icon-button quran-play" type="button" aria-label={playing ? "Pause recitation" : "Play recitation"}
                disabled={completionPage || !directory || (!activeVerse && (loading || !page || !!error))} onClick={toggleRecitation}>
                {audioLoading ? <LoaderCircle className="quran-spinner" size={22} /> : playing ? <Pause size={22} /> : <Play size={22} />}</button>
              <button className="quran-icon-button" type="button" aria-label="Next Ayah" disabled={completionPage || !directory || loading || !page || !!error}
                onClick={() => adjacentVerse(1)}><SkipForward size={20} /></button>
            </div>
            {audioError && <p className="quran-error" role="alert">{audioError}</p>}
            <p className="quran-menu-note">{audioLoading ? "Loading recitation…" : playing ? "Playing · You can close this menu and keep reading." :
              "Tap play to start, or select an Ayah on the page. Audio needs an internet connection."}</p>
          </section>
        </div>}
        {drawer === "more" && <div className="quran-options">
          <section className="quran-menu-section">
            <label className="quran-field-label" htmlFor="quran-page-input">Go to page</label>
            <form className="quran-page-jump" onSubmit={event => {
              event.preventDefault();
              const number = Number(jump);
              if (Number.isInteger(number) && number >= 1 && number <= 604) {
                changePage(number); closeDrawer();
              }
            }}>
              <input id="quran-page-input" aria-label="Page number" type="number" min="1" max="604" value={jump}
                onChange={event => setJump(event.target.value)} required /><span>of 604</span>
              <button type="submit" aria-label="Go to page">Go <ChevronRight size={16} /></button>
            </form>
          </section>
          <section className="quran-menu-section quran-menu-actions">
            <button type="button" onClick={() => { changePage("dua"); closeDrawer(); }}>
              <BookOpen size={20} /><span><strong>Completion duas</strong><small>Short and long Dua Khatm al-Quran</small></span><ChevronRight size={18} />
            </button>
            <button type="button" onClick={() => { closeDrawer(); void toggleFullscreen(); }} aria-label="Toggle fullscreen">
              <Expand size={20} /><span><strong>Fullscreen</strong><small>Show or hide the browser surroundings</small></span><ChevronRight size={18} />
            </button>
            <Link to="/settings"><Settings2 size={20} /><span><strong>All Settings</strong><small>Open your app preferences</small></span><ChevronRight size={18} /></Link>
          </section>
        </div>}
        {drawer === "options" && <div className="quran-options">
          <section className="quran-menu-section">
            <h3>Reading view</h3>
            <div className="quran-view-switch" role="group" aria-label="Reading view">
              <button type="button" aria-label="Switch to scrolling view" aria-pressed={!fitMode} onClick={() => changeReadingMode(false)}>
                <BookOpen size={18} /><span>Scroll</span></button>
              <button type="button" aria-label="Fit whole page to screen" aria-pressed={fitMode} onClick={() => changeReadingMode(true)}>
                <PanelsTopLeft size={18} /><span>Fit page</span></button>
            </div>
          </section>
          <section className="quran-menu-section">
            <h3>Text & translation</h3>
            <div className="quran-menu-field"><span>Arabic script</span><CustomDropdown label="Arabic script" value={preferences.arabicScript}
              options={[{ id: "indopak", name: "Indo-Pak" }, { id: "uthmani", name: "Uthmani" }]}
              onChange={arabicScript => updatePreferences({ arabicScript })} /></div>
            <div className="quran-menu-field"><span>Translation</span><CustomDropdown label="Translation" value={preferences.preferredTranslation} options={TRANSLATION_OPTIONS}
              onChange={preferredTranslation => updatePreferences({ preferredTranslation })} /></div>
            <label className="quran-toggle-row"><span><strong>Show translation</strong><small>Keep the selected translation below the Arabic</small></span>
              <input type="checkbox" role="switch" checked={preferences.showTranslation}
                onChange={event => updatePreferences({ showTranslation: event.target.checked })} /></label>
          </section>
          <section className="quran-menu-section">
          <h3>Text size</h3>
          {(["arabicFontSize", "translationFontSize"] as const).map(key => {
            const arabic = key === "arabicFontSize";
            const min = arabic ? 24 : 12, max = arabic ? 64 : 56;
            const label = arabic ? "Arabic" : "Translation";
            const displayedSize = arabic ? preferences[key] : translationFontSize;
            return <div key={key}><div className="quran-section-heading"><label htmlFor={`quran-${key}`}>{label} text</label>
              <output htmlFor={`quran-${key}`}>{displayedSize}px</output></div>
              <div className="quran-font-stepper">
                <button type="button" aria-label={`Decrease ${label.toLowerCase()} font size`} disabled={preferences[key] <= min}
                  onClick={() => updatePreferences({ [key]: Math.max(min, preferences[key] - 2) })}>−</button>
                <input id={`quran-${key}`} aria-label={`${label} font size`} aria-valuetext={`${displayedSize}px`} type="range" min={min} max={max} value={preferences[key]}
                  onChange={event => updatePreferences({ [key]: Number(event.target.value) })} />
                <button type="button" aria-label={`Increase ${label.toLowerCase()} font size`} disabled={preferences[key] >= max}
                  onClick={() => updatePreferences({ [key]: Math.min(max, preferences[key] + 2) })}>+</button>
              </div>
            </div>;
          })}
          {fitMode && <p className="quran-menu-note">Text sizes apply to every page. Fit page scales the complete layout to your screen; use zoom to read larger without changing your saved text sizes.</p>}
          </section>
          <section className="quran-menu-section">
            <h3>Explanation</h3>
            <div className="quran-menu-field"><span>Tafseer · Urdu</span><CustomDropdown label="Tafseer" value={preferences.preferredTafseer} options={TAFSEER_OPTIONS}
              onChange={preferredTafseer => { setTafseer(null); setTafseerError(""); updatePreferences({ preferredTafseer }); }} /></div>
          </section>
        </div>}
        {drawer === "tafseer" && (tafseerError ? <p className="quran-error" role="alert">{tafseerError}
          <button type="button" onClick={() => openTafseer(tafseerKey)}>Try again</button><Link to="/settings">Settings</Link></p>
          : tafseer ? <section><h3>{tafseer.name}</h3>
            <p className="quran-menu-note">{tafseer.author}</p>
            <p className="quran-tafseer" lang={tafseer.language} dir="rtl"
              style={{ fontSize: preferences.translationFontSize }}>{tafseer.text}</p>
            </section>
            : <p className="quran-directory-loading" role="status"><LoaderCircle className="quran-spinner" size={18} />Loading Sirat-ul-Jinan…</p>)}
      </ReaderDrawer>}
      </main>
      {modal && <UnderConstructionModal featureName={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
