import { useLayoutEffect, useRef, useState } from "react";
import QuranText from "./QuranText";
import { getQuranPageScale, getQuranPageWidth, getQuranSwipeDirection } from "../utils/quranScreens";
import { getQuranLineHeightMultiplier } from "../utils/quranTypography";

// Transcribed from the two consecutive panels at Islamic Academy's supplied source.
// Traditional supplication, not Quran verses or a fixed prophetic completion formula.
const COMPLETION_PANELS = [
  [
    "صَدَقَ اللَّهُ الْعَلِيُّ الْعَظِيمُ",
    "وَصَدَقَ رَسُولُهُ النَّبِيُّ الْكَرِيمُ",
    "وَنَحْنُ عَلَى ذَلِكَ مِنَ الشَّاهِدِينَ",
    "رَبَّنَا تَقَبَّلْ مِنَّا إِنَّكَ أَنْتَ السَّمِيعُ الْعَلِيمُ",
    "اللَّهُمَّ ارْزُقْنَا بِكُلِّ حَرْفٍ مِنَ الْقُرْآنِ حَلَاوَةً وَبِكُلِّ جُزْءٍ مِنَ الْقُرْآنِ جَزَاءً",
    "اللَّهُمَّ ارْزُقْنَا بِالْأَلِفِ أُلْفَةً وَبِالْبَاءِ بَرَكَةً وَبِالتَّاءِ تَوْبَةً وَبِالثَّاءِ ثَوَابًا وَبِالْجِيمِ جَمَالًا وَبِالْحَاءِ حِكْمَةً وَبِالْخَاءِ خَيْرًا وَبِالدَّالِ دَلِيلًا وَبِالذَّالِ ذَكَاءً وَبِالرَّاءِ رَحْمَةً وَبِالزَّايِ زَكٰوةً وَبِالسِّينِ سَعَادَةً وَبِالشِّينِ شِفَاءً وَبِالصَّادِ صِدْقًا وَبِالضَّادِ ضِيَاءً وَبِالطَّاءِ طَرَاوَةً وَبِالظَّاءِ ظَفَرًا وَبِالْعَيْنِ عِلْمًا وَبِالْغَيْنِ غِنًى وَبِالْفَاءِ فَلَاحًا وَبِالْقَافِ قُرْبَةً وَبِالْكَافِ كَرَامَةً وَبِاللَّامِ لُطْفًا وَبِالْمِيمِ مَوْعِظَةً وَبِالنُّونِ نُورًا وَبِالْوَاوِ وُصْلَةً وَبِالْهَاءِ هِدَايَةً وَبِالْيَاءِ يَقِينًا",
    "اللَّهُمَّ انْفَعْنَا بِالْقُرْآنِ الْعَظِيمِ",
    "وَارْفَعْنَا بِالْآيَاتِ وَالذِّكْرِ الْحَكِيمِ",
    "وَتَقَبَّلْ مِنَّا قِرَاءَتَنَا",
  ].join(" ☆ "),
  [
    "وَتَجَاوَزْ عَمَّا كَانَ فِي تِلَاوَةِ الْقُرْآنِ مِنْ خَطَإٍ أَوْ نِسْيَانٍ أَوْ تَحْرِيفِ كَلِمَةٍ عَنْ مَوَاضِعِهَا أَوْ تَقْدِيمٍ أَوْ تَأْخِيرٍ أَوْ زِيَادَةٍ أَوْ نُقْصَانٍ أَوْ تَأْوِيلٍ عَلَى غَيْرِ مَا أَنْزَلْتَهُ عَلَيْهِ أَوْ رَيْبٍ أَوْ شَكٍّ أَوْ سَهْوٍ أَوْ سُوءِ أَلْحَانٍ أَوْ تَعْجِيلٍ عِنْدَ تِلَاوَةِ الْقُرْآنِ أَوْ كَسَلٍ أَوْ مَسْرَعَةٍ أَوْ زَيْغِ لِسَانٍ أَوْ وَقْفٍ بِغَيْرِ مَوْقِفٍ أَوْ إِدْغَامٍ بِغَيْرِ مُدْغَمٍ أَوْ إِظْهَارٍ بِغَيْرِ بَيَانٍ أَوْ مَدٍّ أَوْ تَشْدِيدٍ أَوْ هَمْزَةٍ أَوْ جَزْمٍ أَوْ إِعْرَابٍ بِغَيْرِ مَا كَتَبْتَهُ أَوْ قِلَّةِ رَغْبَةٍ وَرَهْبَةٍ عِنْدَ آيَاتِ الرَّحْمَةِ وَآيَاتِ الْعَذَابِ فَاغْفِرْ لَنَا رَبَّنَا وَاكْتُبْنَا مَعَ الشَّاهِدِينَ",
    "اللَّهُمَّ نَوِّرْ قُلُوبَنَا بِالْقُرْآنِ وَزَيِّنْ أَخْلَاقَنَا بِالْقُرْآنِ",
    "وَنَجِّنَا مِنَ النَّارِ بِالْقُرْآنِ وَأَدْخِلْنَا الْجَنَّةَ بِالْقُرْآنِ",
    "اللَّهُمَّ اجْعَلِ الْقُرْآنَ لَنَا فِي الدُّنْيَا قَرِينًا وَفِي الْقَبْرِ مُونِسًا وَعَلَى الصِّرَاطِ نُورًا وَفِي الْجَنَّةِ رَفِيقًا وَمِنَ النَّارِ سِتْرًا وَحِجَابًا وَإِلَى الْخَيْرَاتِ كُلِّهَا دَلِيلًا وَإِمَامًا فَاكْتُبْنَا عَلَى التَّمَامِ وَارْزُقْنَا ذَلِكَ بِالْقَلْبِ وَاللِّسَانِ وَحُبَّ الْخَيْرِ وَالسَّعَادَةِ وَالْبِشَارَةِ مِنَ الْإِيمَانِ",
    "وَصَلَّى اللَّهُ تَعَالَى عَلَى خَيْرِ خَلْقِهِ مُحَمَّدٍ مَظْهَرِ لُطْفِهِ وَنُورِ عَرْشِهِ سَيِّدِنَا وَمَوْلَانَا مُحَمَّدٍ وَآلِهِ وَأَصْحَابِهِ أَجْمَعِينَ وَسَلَّمَ تَسْلِيمًا كَثِيرًا كَثِيرًا",
  ].join(" ☆ "),
];

function DuaPaper({ panel, index, fontSize, script, fitMode }: {
  panel: string; index: number; fontSize: number; script: "indopak" | "uthmani"; fitMode: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const paper = useRef<HTMLElement>(null);
  const [layout, setLayout] = useState({ width: 720, height: 0, scale: 0 });
  const lineHeight = fontSize * getQuranLineHeightMultiplier(script, fitMode);
  useLayoutEffect(() => {
    const sheet = paper.current, holder = container.current, view = holder?.parentElement;
    if (!sheet || !holder || !view || !fitMode) return;
    let disposed = false, frame = 0, dimensions = "";
    function measure(force = false) {
      if (disposed || !sheet || !holder || !view || document.fonts.status === "loading") return;
      const availableWidth = holder.clientWidth, availableHeight = view.clientHeight - 12;
      const key = `${availableWidth}:${availableHeight}`;
      if (!availableWidth || !availableHeight || (!force && key === dimensions)) return;
      dimensions = key;
      let width = 720;
      const visited = new Set<number>();
      const aspect = availableWidth / availableHeight;
      for (let step = 0; step < 10; step++) {
        sheet.style.width = `${width}px`;
        visited.add(width);
        const next = getQuranPageWidth(width, sheet.offsetHeight, aspect);
        if (visited.has(next)) break;
        width = next;
      }
      sheet.style.width = `${width}px`;
      const height = sheet.offsetHeight;
      setLayout({ width, height, scale: getQuranPageScale(width, height, availableWidth, availableHeight) });
    }
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure());
    });
    observer.observe(holder);
    observer.observe(view);
    const fontsLoaded = () => measure(true);
    measure();
    void document.fonts.ready.then(fontsLoaded);
    document.fonts.addEventListener("loadingdone", fontsLoaded);
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect();
      document.fonts.removeEventListener("loadingdone", fontsLoaded);
    };
  }, [fitMode, fontSize, script]);
  return <div className="quran-completion-sheet" ref={container}>
    <div className={`quran-completion-stage${fitMode ? " quran-completion-stage--fit" : ""}`}
      style={fitMode ? { width: layout.width * layout.scale, height: layout.height * layout.scale } : undefined}>
      <article ref={paper} className={`quran-page quran-completion-page font-${script}`} lang="ar" dir="rtl"
        aria-label={`Completion dua panel ${index + 1}`}
        style={{ fontSize, width: fitMode ? layout.width : "100%",
          transform: fitMode ? `scale(${layout.scale})` : undefined,
          visibility: fitMode && !layout.scale ? "hidden" : undefined }}>
        <header className="quran-surah-banner"><h2><QuranText text="دُعَاءُ خَتْمِ الْقُرْآنِ" script={script} />
          <small lang="en" dir="ltr">{index ? "Continuation" : "Dua Khatm al-Quran"}</small></h2></header>
        {!index && <div className="quran-bismillah"><p><QuranText text="بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ" script={script} /></p></div>}
        <div className="quran-arabic-stream quran-completion-text"
          style={{ lineHeight: `${lineHeight}px`, backgroundSize: `100% ${lineHeight}px` }}>
          <QuranText text={panel} script={script} />
        </div>
      </article>
    </div>
  </div>;
}

export default function QuranCompletionPage({ fontSize, script, fitMode, onTurn, onToggleControls }: {
  fontSize: number; script: "indopak" | "uthmani"; fitMode: boolean; onTurn: (direction: -1 | 1) => void;
  onToggleControls?: () => void;
}) {
  const [long, setLong] = useState(false);
  const viewport = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ id: number; x: number; y: number; time: number } | null>(null);
  return <section className="quran-completion" aria-label="Dua Khatm al-Quran">
    <div className="quran-view-switch" role="group" aria-label="Completion dua length">
      {[false, true].map(value => <button key={String(value)} type="button" aria-pressed={long === value}
        onClick={() => { setLong(value); viewport.current?.scrollTo({ top: 0, behavior: "instant" }); }}>
        {value ? "Long dua" : "Short dua"}
      </button>)}
    </div>
    <p className="quran-completion-hint" role="status">{long ? "Two pages · Scroll down for the continuation." : "Short dua · First source panel."}</p>
    <div className="quran-completion-viewport" ref={viewport} tabIndex={0}
      role="region" aria-label="Completion dua pages" onClick={event => {
        if (!(event.target instanceof Element && event.target.closest("button, a"))) onToggleControls?.();
      }} onTouchStart={event => {
        swipe.current = null;
        if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1.02 ||
          (event.target instanceof Element && event.target.closest("button, a"))) return;
        const touch = event.touches[0];
        swipe.current = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: performance.now() };
      }} onTouchMove={event => {
        if (event.touches.length !== 1 || (window.visualViewport?.scale ?? 1) > 1.02) swipe.current = null;
      }} onTouchEnd={event => {
        const start = swipe.current;
        swipe.current = null;
        if (!start || event.touches.length || (window.visualViewport?.scale ?? 1) > 1.02) return;
        const touch = Array.from(event.changedTouches).find(candidate => candidate.identifier === start.id);
        if (!touch) return;
        const direction = getQuranSwipeDirection(touch.clientX - start.x, touch.clientY - start.y, performance.now() - start.time);
        if (direction) onTurn(direction);
      }} onTouchCancel={() => { swipe.current = null; }} onKeyDown={event => {
        if (event.target !== event.currentTarget || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault(); onTurn(event.key === "ArrowRight" ? 1 : -1);
        }
      }}>
      {(long ? COMPLETION_PANELS : COMPLETION_PANELS.slice(0, 1)).map((panel, index) =>
        <DuaPaper key={index} panel={panel} index={index} fontSize={fontSize} script={script} fitMode={fitMode} />)}
    </div>
  </section>;
}
