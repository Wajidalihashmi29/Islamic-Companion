import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Expand, Headphones, LoaderCircle, MoreHorizontal,
  PanelsTopLeft, Pause, Play, Settings2, SkipBack, SkipForward, X, ZoomIn, ZoomOut } from "lucide-react";
import TopNav from "../components/TopNav";
import CustomDropdown from "../components/CustomDropdown";
import AyahMedallion, { toArabicDigits, toUrduDigits } from "../components/AyahMedallion";
import QuranText from "../components/QuranText";
import UnderConstructionModal from "../components/UnderConstructionModal";
import { useAuth } from "../context/AuthContext";
import { getQuranAudio, getQuranDirectory, getQuranPage, getQuranTafseer, getVersePage } from "../api/quranApi";
import type { QuranDirectory, QuranPage, QuranSurah, QuranTafseer } from "../api/quranApi";
import { layoutQuranLines } from "../utils/quranLayout";
import type { QuranReadingLine, QuranReadingSegment } from "../utils/quranLayout";
import { getQuranTextRuns, getQuranTranslationFontSize } from "../utils/quranTypography";
import { getStorageKeyForUser, loadSettings, saveSettings, RECITERS_OPTIONS, TRANSLATION_OPTIONS, TAFSEER_OPTIONS } from "../utils/settingsStorage";
import { loadQuranReaderView, loadQuranReadingPage, normalizeQuranSearch, parseAyahReference,
  saveQuranReaderView, saveQuranReadingPage } from "../utils/quranNavigation";
import { getQuranPageScale, getQuranPageWidth, getQuranSwipeDirection, QURAN_PAGE_ASPECT_RATIO } from "../utils/quranScreens";
import type { AppSettings } from "../utils/settingsStorage";
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
  if (axios.isAxiosError<{ message?: string }>(error)) return error.response?.data?.message || fallback;
  return error instanceof Error ? error.message : fallback;
}

function QuranGlyph({ text, script, className, label, alignment = "xMidYMax meet" }: {
  text: string; script: string; className: string; label: string; alignment?: string;
}) {
  const ref = useRef<SVGTextElement>(null);
  const [viewBox, setViewBox] = useState("");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) throw new Error("Unable to measure Quran glyphs.");
    let disposed = false;
    const fit = () => {
      if (disposed || !element.isConnected) return;
      const style = getComputedStyle(element);
      context.font = `${style.fontSize} ${style.fontFamily}`;
      context.direction = "ltr";
      const { actualBoundingBoxLeft: left, actualBoundingBoxRight: right,
        actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = context.measureText(text);
      setViewBox(`${-left - 1} ${-ascent - 1} ${left + right + 2} ${ascent + descent + 2}`);
    };
    const frame = requestAnimationFrame(fit);
    void document.fonts.ready.then(fit);
    document.fonts.addEventListener("loadingdone", fit);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      document.fonts.removeEventListener("loadingdone", fit);
    };
  }, [text, script]);
  return (
    <svg className={className} viewBox={viewBox || undefined} preserveAspectRatio={alignment}
      role="img" aria-label={label} style={{ visibility: viewBox ? "visible" : "hidden" }}>
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
      {surah.number !== 1 && surah.number !== 9 && (
        <div className="quran-bismillah">
          <p className="quran-bismillah-arabic" lang="ar" dir="rtl" style={{ fontSize: settings.arabicFontSize }}>
            <span aria-hidden="true">❊</span>
            <QuranGlyph text={"\uFC41 \uFC42 \uFC43 \uFC44"} script="qpc-v2"
              className="quran-bismillah-glyph" label="بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيمِ" />
            <span aria-hidden="true">❊</span>
          </p>
          {settings.showTranslation && <p lang={page.translationLanguage}
            style={{ fontSize: getQuranTranslationFontSize(settings.translationFontSize, page.translationLanguage) }}>{page.bismillahTranslation}</p>}
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
  const [resume] = useState(() => {
    let page = 1;
    try {
      page = loadQuranReadingPage(profileKey) ?? 1;
      return { page, view: loadQuranReaderView(profileKey), error: "" };
    } catch (error) {
      console.warn("Unable to load Quran reading progress.", error);
      return { page, view: { mode: "scroll", position: null }, error: "Reading progress could not be restored from this browser." };
    }
  });
  const [readingError, setReadingError] = useState(resume.error);
  const requested = Number(params.get("page") ?? resume.page);
  const pageNumber = Number.isInteger(requested) && requested >= 1 && requested <= 604 ? requested : 1;
  const [settings, setSettings] = useState(() => loadSettings());
  const preferences = settings.quran;
  const [page, setPage] = useState<QuranPage | null>(null);
  const [directory, setDirectory] = useState<QuranDirectory | null>(null);
  const [lineLayout, setLineLayout] = useState<{
    lines: QuranReadingLine[]; width: number; page: QuranPage | null; script: string; fontSize: number;
  }>({ lines: [], width: 0, page: null, script: "", fontSize: 0 });
  const lines = lineLayout.lines;
  const [loadedKey, setLoadedKey] = useState("");
  const [error, setError] = useState("");
  const [directoryError, setDirectoryError] = useState("");
  const [retry, setRetry] = useState(0);
  const requestKey = `${pageNumber}:${preferences.preferredTranslation}:${preferences.mushafLines}:${retry}`;
  const loading = loadedKey !== requestKey;
  const [drawer, setDrawer] = useState<"index" | "listen" | "options" | "more" | "tafseer" | null>(null);
  const [modal, setModal] = useState<string | null>(null);
  const [jump, setJump] = useState(String(pageNumber));
  const [search, setSearch] = useState("");
  const [directorySection, setDirectorySection] = useState<"surahs" | "juzs">("surahs");
  const [activeVerse, setActiveVerse] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [tafseerKey, setTafseerKey] = useState("");
  const [tafseer, setTafseer] = useState<QuranTafseer | null>(null);
  const [tafseerError, setTafseerError] = useState("");
  const [navigationError, setNavigationError] = useState("");
  const [navigationPending, setNavigationPending] = useState(false);
  const [verseTarget, setVerseTarget] = useState<{ key: string; page: number } | null>(null);
  const [fitMode, setFitMode] = useState(resume.view.mode === "fit");
  const [fitWidth, setFitWidth] = useState(720);
  const [pageZoom, setPageZoom] = useState(1);
  const [browserZoomed, setBrowserZoomed] = useState(false);
  const [pageFit, setPageFit] = useState<{
    page: QuranPage | null; lines: QuranReadingLine[] | null; width: number; height: number; scale: number;
  }>({ page: null, lines: null, width: 0, height: 0, scale: 0 });
  const probe = useRef<HTMLDivElement>(null);
  const audio = useRef<HTMLAudioElement>(null);
  const frame = useRef<HTMLElement>(null);
  const navigationRequest = useRef<AbortController | null>(null);
  const directoryResults = useRef<HTMLDivElement>(null);
  const scrolledTarget = useRef<typeof verseTarget>(null);
  const readingViewport = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const fitSizing = useRef({ key: "", attempts: 0, fittingWidth: 0 });
  const gesture = useRef<{ x: number; y: number; time: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const fitReady = pageFit.page === page && pageFit.lines === lines && pageFit.width === fitWidth && pageFit.scale > 0;
  const firstReadingVerse = page?.lines[0]?.segments[0]?.verseKey;

  useEffect(() => {
    if (!params.has("page")) setParams({ page: String(pageNumber) }, { replace: true });
  }, [params, pageNumber, setParams]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => setBrowserZoomed(viewport.scale > 1.02);
    const animation = requestAnimationFrame(sync);
    viewport.addEventListener("resize", sync);
    return () => { cancelAnimationFrame(animation); viewport.removeEventListener("resize", sync); };
  }, []);

  useEffect(() => {
    if (directoryResults.current) directoryResults.current.scrollTop = 0;
  }, [search, directorySection]);

  useEffect(() => {
    const sync = () => setSettings(loadSettings());
    window.addEventListener("ic:settingsUpdated", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("ic:settingsUpdated", sync);
      window.removeEventListener("storage", sync);
      navigationRequest.current?.abort();
    };
  }, []);

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
    const controller = new AbortController();
    getQuranPage(pageNumber, preferences.preferredTranslation, preferences.mushafLines, controller.signal)
      .then(data => {
        if (controller.signal.aborted) return;
        setPage(data); setError("");
        try {
          saveQuranReadingPage(profileKey, data.pageNumber);
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
  }, [pageNumber, preferences.preferredTranslation, preferences.mushafLines, requestKey, profileKey]);

  useEffect(() => {
    const element = probe.current;
    if (!element || !page || loading) return;
    let disposed = false;
    let animation = 0;
    const calculate = () => {
      if (disposed || !element.isConnected || element.clientWidth <= 0) return;
      const style = getComputedStyle(element);
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const span = document.createElement("span");
      span.style.cssText = "display:inline-block;white-space:pre;";
      element.appendChild(span);
      const scale = paper.current ? paper.current.getBoundingClientRect().width / paper.current.offsetWidth : 1;
      const measure = (text: string) => {
        span.replaceChildren(...getQuranTextRuns(text, preferences.arabicScript).map(run => {
          if (!run.fallback) return document.createTextNode(run.text);
          const word = document.createElement("span");
          word.className = "quran-indopak-fallback";
          word.textContent = run.text;
          return word;
        }));
        return span.getBoundingClientRect().width / scale;
      };
      const result = layoutQuranLines(page.lines, preferences.arabicScript, width, measure,
        Math.max(32, preferences.arabicFontSize) + 6);
      span.remove();
      setLineLayout({ lines: result, width: element.clientWidth, page,
        script: preferences.arabicScript, fontSize: preferences.arabicFontSize });
    };
    const schedule = () => { cancelAnimationFrame(animation); animation = requestAnimationFrame(calculate); };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    void document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    return () => {
      disposed = true;
      cancelAnimationFrame(animation);
      observer.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [page, loading, preferences.arabicScript, preferences.arabicFontSize]);

  useEffect(() => {
    const viewport = readingViewport.current, sheet = paper.current;
    if (!fitMode || loading || !lineLayout.lines.length || !viewport || !sheet) return;
    let disposed = false;
    let animation = 0;
    const calculate = () => {
      if (disposed || viewport.offsetHeight <= 2 || viewport.offsetWidth <= 2 ||
        lineLayout.page !== page || lineLayout.script !== preferences.arabicScript ||
        lineLayout.fontSize !== preferences.arabicFontSize ||
        Math.abs((probe.current?.clientWidth ?? 0) - lineLayout.width) > 1) return;
      const width = sheet.offsetWidth, height = sheet.offsetHeight;
      const availableWidth = viewport.offsetWidth - 2, availableHeight = viewport.offsetHeight - 2;
      const key = `${requestKey}:${availableWidth}:${availableHeight}:${preferences.arabicScript}:${preferences.arabicFontSize}:${preferences.translationFontSize}:${preferences.showTranslation}:${document.fonts.status}`;
      if (fitSizing.current.key !== key) fitSizing.current = { key, attempts: 0, fittingWidth: 0 };
      const fitsPortrait = height <= width / QURAN_PAGE_ASPECT_RATIO + 1;
      if (fitsPortrait && (!fitSizing.current.fittingWidth || width < fitSizing.current.fittingWidth))
        fitSizing.current.fittingWidth = width;
      const style = getComputedStyle(sheet);
      // Exclude the empty space reserved by the portrait paper's minimum height.
      const contentHeight = Array.from(sheet.querySelectorAll<HTMLElement>(":scope > *"))
        .reduce((total, child) => total + child.offsetHeight, 0) +
        parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + sheet.offsetHeight - sheet.clientHeight;
      // Row breaks can oscillate between widths; finish at a width that actually fits the portrait paper.
      const balancedWidth = fitSizing.current.attempts < 6 ? getQuranPageWidth(width, contentHeight)
        : fitsPortrait ? width : fitSizing.current.fittingWidth ||
          Math.min(3200, Math.ceil(contentHeight * QURAN_PAGE_ASPECT_RATIO / 8) * 8);
      if (balancedWidth !== width) {
        fitSizing.current.attempts++;
        setFitWidth(balancedWidth);
        return;
      }
      const scale = getQuranPageScale(width, height, availableWidth, availableHeight);
      setPageFit(previous => previous.page === page && previous.lines === lineLayout.lines && previous.width === width &&
        previous.height === height && previous.scale === scale ? previous : {
          page, lines: lineLayout.lines, width, height, scale,
        });
    };
    const schedule = () => { cancelAnimationFrame(animation); animation = requestAnimationFrame(calculate); };
    const observer = new ResizeObserver(schedule);
    observer.observe(viewport); observer.observe(sheet);
    schedule();
    void document.fonts.ready.then(schedule);
    document.fonts.addEventListener("loadingdone", schedule);
    return () => {
      disposed = true; cancelAnimationFrame(animation); observer.disconnect();
      document.fonts.removeEventListener("loadingdone", schedule);
    };
  }, [fitMode, fitWidth, lineLayout, page, requestKey, loading, preferences.arabicScript, preferences.arabicFontSize,
    preferences.showTranslation, preferences.translationFontSize]);

  useEffect(() => {
    if (loading || error || !page || page.pageNumber !== pageNumber) return;
    try {
      saveQuranReaderView(profileKey, { mode: fitMode ? "fit" : "scroll", position: null });
    } catch (error) {
      console.warn("Unable to save Quran reading view.", error);
      const animation = requestAnimationFrame(() => setReadingError("Reading progress could not be saved. Enable site storage in this browser to resume later."));
      return () => cancelAnimationFrame(animation);
    }
  }, [fitMode, page, pageNumber, loading, error, profileKey]);

  useEffect(() => {
    if (!verseTarget || verseTarget.page !== pageNumber || loading || scrolledTarget.current === verseTarget) return;
    if (fitMode && !fitReady) return;
    let disposed = false;
    let animation = 0;
    void document.fonts.ready.then(() => {
      animation = requestAnimationFrame(() => {
        if (disposed) return;
        const element = Array.from(frame.current?.querySelectorAll<HTMLElement>(".quran-verse") ?? [])
          .find(verse => verse.dataset.verseKey === verseTarget.key);
        if (!element) return;
        if (!fitMode || pageZoom > 1)
          element.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
        scrolledTarget.current = verseTarget;
      });
    });
    return () => { disposed = true; cancelAnimationFrame(animation); };
  }, [verseTarget, pageNumber, loading, lines, fitMode, fitReady, pageZoom]);

  useEffect(() => {
    if (!activeVerse || !audio.current) return;
    const controller = new AbortController();
    const element = audio.current;
    getQuranAudio(activeVerse, preferences.reciter, controller.signal).then(async result => {
      if (controller.signal.aborted) return;
      element.src = result.url;
      await element.play();
    }).catch(error => {
      if (!controller.signal.aborted) {
        setAudioError(errorMessage(error, "Unable to play this recitation."));
        setPlaying(false);
        setActiveVerse(null);
      }
    }).finally(() => { if (!controller.signal.aborted) setAudioLoading(false); });
    return () => { controller.abort(); element.pause(); element.removeAttribute("src"); element.load(); };
  }, [activeVerse, preferences.reciter]);

  useEffect(() => {
    if (drawer !== "tafseer" || !tafseerKey) return;
    const controller = new AbortController();
    getQuranTafseer(tafseerKey, preferences.preferredTafseer, controller.signal).then(setTafseer).catch(error => {
      if (!controller.signal.aborted) setTafseerError(errorMessage(error, "Unable to load Tafseer."));
    });
    return () => controller.abort();
  }, [drawer, tafseerKey, preferences.preferredTafseer]);

  function updatePreferences(update: Partial<AppSettings["quran"]>) {
    const next = { ...settings, quran: { ...settings.quran, ...update } };
    if (update.preferredTranslation || update.mushafLines) setError("");
    if (update.reciter && activeVerse) { setAudioLoading(true); setAudioError(""); }
    setSettings(next);
    saveSettings(next);
  }
  function changePage(number: number, keepAudio = false) {
    if (number < 1 || number > 604 || number === pageNumber) return;
    if (!keepAudio) { setActiveVerse(null); setPlaying(false); }
    setError(""); setLineLayout(previous => ({ ...previous, lines: [] })); setVerseTarget(null);
    setPageZoom(1);
    setDrawer(null);
    readingViewport.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    setJump(String(number));
    setParams({ page: String(number) });
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function turnPage(delta: number) {
    if (!fitMode || !fitReady || loading || error || drawer || modal) return;
    changePage(pageNumber + delta);
  }
  function changeReadingMode(enabled: boolean) {
    scrolledTarget.current = null;
    setPageZoom(1);
    setFitMode(enabled);
  }
  function zoomPage(zoom: number) {
    const viewport = readingViewport.current;
    if (!viewport || !fitReady) return;
    const next = Math.max(1, Math.min(4, zoom));
    const oldMargin = Math.max(0, (viewport.clientWidth - pageFit.width * pageFit.scale * pageZoom) / 2);
    const newMargin = Math.max(0, (viewport.clientWidth - pageFit.width * pageFit.scale * next) / 2);
    const oldVerticalMargin = Math.max(0, (viewport.clientHeight - pageFit.height * pageFit.scale * pageZoom) / 2);
    const newVerticalMargin = Math.max(0, (viewport.clientHeight - pageFit.height * pageFit.scale * next) / 2);
    const x = (viewport.scrollLeft + viewport.clientWidth / 2 - oldMargin) / pageZoom;
    const y = (viewport.scrollTop + viewport.clientHeight / 2 - oldVerticalMargin) / pageZoom;
    setPageZoom(next);
    requestAnimationFrame(() => viewport.scrollTo({
      left: next === 1 ? 0 : x * next + newMargin - viewport.clientWidth / 2,
      top: next === 1 ? 0 : y * next + newVerticalMargin - viewport.clientHeight / 2, behavior: "instant",
    }));
  }
  function startSwipe(event: TouchEvent<HTMLDivElement>) {
    gesture.current = null;
    if (!fitMode || pageZoom > 1 || (window.visualViewport?.scale ?? 1) > 1.02 || event.touches.length !== 1 ||
      (event.target instanceof Element && event.target.closest("button, input, a, select, textarea"))) return;
    const touch = event.touches[0], bounds = event.currentTarget.getBoundingClientRect();
    if (touch.clientX < bounds.left + 16 || touch.clientX > bounds.right - 16) return;
    gesture.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  }
  function endSwipe(event: TouchEvent<HTMLDivElement>) {
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
  async function goToVerse(key: string, keepAudio = false) {
    navigationRequest.current?.abort();
    const controller = new AbortController();
    navigationRequest.current = controller;
    setNavigationError(""); setNavigationPending(true);
    try {
      const number = await getVersePage(key, controller.signal);
      if (!controller.signal.aborted) {
        changePage(number, keepAudio);
        setVerseTarget({ key, page: number });
        setDrawer(null);
      }
    } catch (error) {
      if (!controller.signal.aborted) setNavigationError(errorMessage(error, "Unable to navigate to this Ayah."));
    } finally {
      if (!controller.signal.aborted) setNavigationPending(false);
    }
  }
  function updateDirectorySearch(value: string) {
    navigationRequest.current?.abort();
    setNavigationPending(false); setNavigationError(""); setSearch(value);
  }
  function closeDrawer() {
    if (drawer === "index") {
      navigationRequest.current?.abort();
      setNavigationPending(false);
    }
    setDrawer(null);
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
    setAudioError("");
    if (activeVerse === key && audio.current?.src) {
      if (audio.current.paused) void audio.current.play().catch(error => setAudioError(errorMessage(error, "Unable to resume audio.")));
      else audio.current.pause();
      return;
    }
    setAudioLoading(true); setActiveVerse(key);
  }
  function toggleRecitation() {
    const key = activeVerse ?? firstReadingVerse;
    if (key) recite(key);
  }
  function adjacentVerse(delta: number) {
    const key = activeVerse ?? firstReadingVerse;
    if (!key || !directory) return;
    let [surah, ayah] = key.split(":").map(Number);
    ayah += delta;
    if (ayah > directory.surahs[surah - 1].ayahCount) { surah++; ayah = 1; }
    if (ayah < 1) { surah--; ayah = directory.surahs[surah - 1]?.ayahCount ?? 0; }
    if (surah < 1 || surah > 114) { setActiveVerse(null); setPlaying(false); return; }
    const next = `${surah}:${ayah}`;
    setAudioError(""); setAudioLoading(true); setActiveVerse(next);
    if (!page?.lines.some(line => line.segments.some(segment => segment.verseKey === next))) void goToVerse(next, true);
    else if (fitMode) setVerseTarget({ key: next, page: pageNumber });
  }
  function openTafseer(key: string) {
    setTafseerKey(key); setTafseer(null); setTafseerError(""); setDrawer("tafseer");
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
    lineHeight: `${preferences.arabicFontSize * (preferences.arabicScript === "indopak" ? 1.85 : 2.65)}px` };
  const searchTerm = normalizeQuranSearch(search);
  const isAyahSearch = searchTerm.includes(":");
  const ayahReference = parseAyahReference(search);
  const matchesDirectorySearch = (number: number, name: string) => /^\d+$/.test(searchTerm)
    ? number === Number(searchTerm) : normalizeQuranSearch(name).includes(searchTerm);
  const matchingSurahs = directory?.surahs.filter(surah => matchesDirectorySearch(surah.number,
    `${surah.name} ${surah.nameArabic} Surah ${surah.number}`)) ?? [];
  const matchingJuzs = directory?.juzs.filter(juz => matchesDirectorySearch(juz.number,
    `${juz.nameArabic} Juz ${juz.number} Para ${juz.number}`)) ?? [];
  const directoryCount = directorySection === "surahs" ? matchingSurahs.length : matchingJuzs.length;
  const translationLanguage = TRANSLATION_OPTIONS.find(option => option.id === preferences.preferredTranslation)?.lang ?? "";
  const translationFontSize = getQuranTranslationFontSize(preferences.translationFontSize, translationLanguage);
  const readerError = (drawer !== "index" && navigationError) || (drawer !== "listen" && audioError);
  const drawerDetails = drawer && {
    index: { title: "Browse Quran", description: "Find a Surah, Para or specific Ayah.", icon: <BookOpen size={20} /> },
    listen: { title: "Listen", description: "Choose a reciter and control your recitation.", icon: <Headphones size={20} /> },
    options: { title: "Reader options", description: "Adjust the reading view, text and translation.", icon: <Settings2 size={20} /> },
    more: { title: "More controls", description: "Jump to a page or open additional settings.", icon: <MoreHorizontal size={20} /> },
    tafseer: { title: `Tafseer · ${tafseerKey}`, description: "Explanation of the selected Ayah.", icon: <BookOpen size={20} /> },
  }[drawer];

  return (
    <div className="home-page">
      {!fitMode && <TopNav activeView="quran" onViewChange={view => {
        if (view === "quran") return;
        if (view === "dashboard" || view === "prayer") navigate(view === "prayer" ? "/?view=prayer" : "/");
        else setModal(view);
      }} onLogout={() => { logout(); navigate("/"); }} onSettingsClick={() => navigate("/settings")} />}
      <main className={`quran-reader ${fitMode ? "quran-reader--fit" : ""}`} ref={frame}>
        <header className="home-view-header">
          <Link className="home-back-btn" to="/" aria-label="Back to dashboard"><ArrowLeft size={20} /></Link>
          <div><span className="home-eyebrow">Read & reflect</span><h1>Qur&apos;an Reader</h1></div>
          <span className="quran-reader-location">Page <strong>{pageNumber}</strong> / 604</span>
        </header>
        {readerError && <p className="quran-error" role="alert">{readerError}</p>}
        {readingError && <p className="quran-error" role="alert">{readingError}</p>}
        {loading ? <p className="quran-status" role="status"><LoaderCircle className="quran-spinner" /> Loading Quran page…</p>
          : error ? <div className="quran-error" role="alert">{error} <button type="button" onClick={() => {
            setRetry(value => value + 1);
          }}>Try again</button> <Link to="/settings">Settings</Link></div>
          : page && (
            <div className="quran-reading-viewport" ref={readingViewport} tabIndex={fitMode ? 0 : undefined}
                role={fitMode ? "region" : undefined} aria-label={fitMode ? "Whole Quran page" : undefined}
                style={fitMode ? { touchAction: pageZoom > 1 || browserZoomed ? "pan-x pan-y pinch-zoom" : "pan-y pinch-zoom" } : undefined}
                onTouchStart={startSwipe} onTouchEnd={endSwipe}
                onTouchMove={event => { if (event.touches.length !== 1) gesture.current = null; }}
                onTouchCancel={() => { gesture.current = null; }}
                onClickCapture={event => {
                  if (Date.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
                }}
                onKeyDown={event => {
                  if (!fitMode || pageZoom > 1 || (window.visualViewport?.scale ?? 1) > 1.02 ||
                    event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
                  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                    event.preventDefault(); turnPage(event.key === "ArrowRight" ? 1 : -1);
                  }
                }}>
              {fitMode && !fitReady && <span className="quran-fit-status" role="status">Fitting whole page…</span>}
              <div className="quran-page-stage" style={fitMode ? {
                width: pageFit.width * pageFit.scale * pageZoom,
                height: pageFit.height * pageFit.scale * pageZoom,
              } : undefined}>
              <article ref={paper} className={`quran-page ${arabicClass} ${pageNumber <= 2 ? "quran-page--opening" : ""}`}
                style={{ fontSize: `${preferences.arabicFontSize}px`, ...(fitMode ? {
                  width: fitWidth, minHeight: fitWidth / QURAN_PAGE_ASPECT_RATIO,
                  transform: `scale(${fitReady ? pageFit.scale * pageZoom : 1})`,
                  visibility: fitReady ? undefined : "hidden",
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
                          <span className={`quran-verse ${activeVerse === segment.verseKey ? "is-reciting" : ""} ${segment.isSajdah ? "is-sajdah" : ""} ${verseTarget?.page === pageNumber && verseTarget.key === segment.verseKey ? "is-targeted" : ""}`}
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
              </article>
              </div>
              </div>
          )}
        <div className="quran-controls">
          <nav className="quran-page-navigation" aria-label="Page navigation and zoom">
            <button type="button" aria-label="Previous page" disabled={loading || !!error || (fitMode && !fitReady) || pageNumber === 1}
              onClick={() => changePage(pageNumber - 1)}><ChevronLeft size={20} /></button>
            {fitMode ? <div className="quran-page-zoom">
              <button type="button" aria-label="Zoom out" disabled={!fitReady || pageZoom <= 1}
                onClick={() => zoomPage(pageZoom - .5)}><ZoomOut size={20} /></button>
              <button type="button" className="quran-fit-reset" aria-label="Fit whole page" disabled={!fitReady}
                onClick={() => zoomPage(1)}>{pageZoom === 1 ? "Fit page" : `${Math.round(pageZoom * 100)}%`}</button>
              <button type="button" aria-label="Zoom in" disabled={!fitReady || pageZoom >= 4}
                onClick={() => zoomPage(pageZoom + .5)}><ZoomIn size={20} /></button>
            </div> : <div className="quran-dock-position">
              <strong>Page {pageNumber} <span>/ 604</span></strong>
              <small>{currentSurah ? `${currentSurah.name} · Para ${page?.juzNumber}` : "Quran reader"}</small>
            </div>}
            <button type="button" aria-label="Next page" disabled={loading || !!error || (fitMode && !fitReady) || pageNumber === 604}
              onClick={() => changePage(pageNumber + 1)}><ChevronRight size={20} /></button>
          </nav>
          <nav className={`quran-toolbar${activeVerse ? " quran-toolbar--reciting" : ""}`} aria-label="Reader controls">
            {activeVerse && <button type="button" className="quran-playback-toggle"
              aria-label={playing ? "Pause recitation" : "Play recitation"} title={`Ayah ${activeVerse}`}
              disabled={audioLoading || loading || !page || !!error} onClick={toggleRecitation}>
              {audioLoading ? <LoaderCircle className="quran-spinner" size={19} /> : playing ? <Pause size={19} /> : <Play size={19} />}
              <span>{audioLoading ? "Loading" : playing ? "Pause" : "Resume"}</span>
            </button>}
            <button type="button" aria-label="Surah and Juz directory" aria-haspopup="dialog" aria-expanded={drawer === "index"} onClick={() => {
              updateDirectorySearch(""); setDrawer("index");
            }}><BookOpen size={19} /><span>Browse</span></button>
            <button type="button" aria-label="Reciter settings" aria-haspopup="dialog" aria-expanded={drawer === "listen"}
              className={playing ? "is-playing" : undefined} onClick={() => setDrawer("listen")}>
              <Headphones size={19} /><span>Listen</span></button>
            <button type="button" aria-label="Reader options" aria-haspopup="dialog" aria-expanded={drawer === "options"}
              onClick={() => setDrawer("options")}><Settings2 size={19} /><span>Display</span></button>
            <button type="button" aria-label="More reader controls" aria-haspopup="dialog" aria-expanded={drawer === "more"}
              onClick={() => setDrawer("more")}><MoreHorizontal size={19} /><span>More</span></button>
          </nav>
          {fitMode && <p className="quran-dock-hint">{browserZoomed ? "Drag to read · Pinch back to zoom out" : pageZoom > 1
            ? "Drag to read · Fit page to restore the whole page" : "Pinch or + to read larger · Swipe right for next"}</p>}
        </div>
        <audio ref={audio} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
          onEnded={() => adjacentVerse(1)} onError={() => {
            setAudioError("The recitation could not be loaded. Please try another reciter.");
            setPlaying(false); setAudioLoading(false); setActiveVerse(null);
          }} />
      {drawer && drawerDetails && <ReaderDrawer {...drawerDetails}
        className={drawer === "index" ? "quran-directory-drawer" : ""} onClose={closeDrawer}>
        {drawer === "index" && <>
          {directoryError && <p className="quran-error" role="alert">{directoryError}<button onClick={() => {
            setDirectoryError(""); setRetry(value => value + 1);
          }}>Try again</button></p>}
          {!directory && !directoryError && <p role="status">Loading directory…</p>}
          <div className="quran-directory-switch" role="group" aria-label="Browse Quran by">
            <button type="button" aria-pressed={directorySection === "surahs"} onClick={() => {
              setDirectorySection("surahs"); updateDirectorySearch("");
            }}>Surahs <span>114</span></button>
            <button type="button" aria-pressed={directorySection === "juzs"} onClick={() => {
              setDirectorySection("juzs"); updateDirectorySearch("");
            }}>Juz / Para <span>30</span></button>
          </div>
          <form className="quran-directory-search" onSubmit={event => {
            event.preventDefault();
            if (isAyahSearch) searchAyah();
          }}>
            <input className="quran-search" type="search"
              aria-label={directorySection === "surahs" ? "Search Surahs or Ayah" : "Search Juz, Para or Ayah"}
              placeholder="Name, number, or 33:56" value={search} onChange={event => updateDirectorySearch(event.target.value)} />
            <button type="submit" aria-label="Go to Ayah" disabled={!isAyahSearch || navigationPending}>
              {navigationPending ? <LoaderCircle className="quran-spinner" size={18} /> : "Go"}
            </button>
          </form>
          {navigationError && <p className="quran-error" role="alert">{navigationError}</p>}
          {navigationPending && <p className="quran-directory-count" role="status">Finding Ayah…</p>}
          {!isAyahSearch && directory && <p className="quran-directory-count" role="status">
            {directoryCount ? `${directoryCount} ${directorySection === "surahs" ? "Surahs" : "Juz / Para"}` : "No matches. Try another name or number."}
          </p>}
          <div className="quran-directory-results" ref={directoryResults} role="region"
            aria-label={directorySection === "surahs" ? "Surah results" : "Juz and Para results"}>
            {isAyahSearch ? <p className="quran-directory-count">
              {ayahReference ? `Press Go or Enter to open Ayah ${ayahReference}.` : "Use Surah:Ayah, for example 33:56."}
            </p> :
            <div className={`quran-index ${directorySection === "juzs" ? "quran-index--juz" : ""}`}>
              {directorySection === "surahs" ? matchingSurahs.map(surah => (
                <button type="button" key={surah.number} aria-current={surah.number === currentSurah?.number ? "true" : undefined}
                  onClick={() => { changePage(surah.startPage); setDrawer(null); }}>
                  <span className="quran-index-number">{surah.number}</span>
                  <span className="quran-index-name"><strong>{surah.name}</strong><small>{surah.ayahCount} Ayahs · Page {surah.startPage}</small></span>
                  <span lang="ar">{surah.nameArabic}</span>
                </button>
              )) : matchingJuzs.map(juz => (
                <button type="button" key={juz.number} aria-current={juz.number === page?.juzNumber ? "true" : undefined}
                  onClick={() => void goToVerse(juz.verseKey)}>
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
              <span>{activeVerse ? `Ayah ${activeVerse}` : `Page ${pageNumber}`}</span></div>
            <div className="quran-audio-controls">
              <button className="quran-icon-button" type="button" aria-label="Previous Ayah" disabled={!directory || loading || !page || !!error}
                onClick={() => adjacentVerse(-1)}><SkipBack size={20} /></button>
              <button className="quran-icon-button quran-play" type="button" aria-label={playing ? "Pause recitation" : "Play recitation"}
                disabled={audioLoading || loading || !page || !!error} onClick={toggleRecitation}>
                {audioLoading ? <LoaderCircle className="quran-spinner" size={22} /> : playing ? <Pause size={22} /> : <Play size={22} />}</button>
              <button className="quran-icon-button" type="button" aria-label="Next Ayah" disabled={!directory || loading || !page || !!error}
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
            const min = arabic ? 24 : 12, max = arabic ? 52 : 28;
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
          </section>
          <section className="quran-menu-section">
            <h3>Explanation</h3>
            <div className="quran-menu-field"><span>Tafseer</span><CustomDropdown label="Tafseer" value={preferences.preferredTafseer} options={TAFSEER_OPTIONS}
              onChange={preferredTafseer => { setTafseer(null); setTafseerError(""); updatePreferences({ preferredTafseer }); }} /></div>
          </section>
        </div>}
        {drawer === "tafseer" && (tafseerError ? <p className="quran-error" role="alert">{tafseerError} <Link to="/settings">Settings</Link></p>
          : tafseer ? <section><h3 lang={tafseer.language}>{tafseer.name}</h3>
            <p className="quran-tafseer" lang={tafseer.language} dir="rtl">{tafseer.text}</p></section>
            : <p role="status">Loading Tafseer…</p>)}
      </ReaderDrawer>}
      </main>
      {modal && <UnderConstructionModal featureName={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
