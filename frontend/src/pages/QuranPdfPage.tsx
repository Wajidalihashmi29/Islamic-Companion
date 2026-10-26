import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpenText,
  Download,
  Layers,
  X,
  MoreVertical,
  Home as HomeIcon,
  RotateCcw,
  BookMarked,
  Star,
  Search,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import * as pdfjsLib from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { useAuth } from "../context/AuthContext";
import { getStorageKeyForUser, queueCloudSave } from "../utils/settingsStorage";
import { loadQuranFavoriteSurahs, saveQuranFavoriteSurahs } from "../utils/quranNavigation";
import {
  QURAN_JUZ_LIST,
  getJuzPageCount,
  getPrintedPageNumber,
  mapPrintedPageToJuz,
  MAX_PRINTED_PAGE,
  MIN_PRINTED_PAGE,
} from "../utils/quranJuzList";
import type { QuranJuzInfo } from "../utils/quranJuzList";
import { QURAN_SURAHS } from "../utils/quranSurahList";
import "./Home.css";
import "./QuranPdfPage.css";

// 1. Polyfills for older web engines
if (typeof Uint8Array !== "undefined") {
  if (!(Uint8Array.prototype as any).toHex) {
    (Uint8Array.prototype as any).toHex = function () {
      return Array.from(this)
        .map(b => (b as number).toString(16).padStart(2, "0"))
        .join("");
    };
  }
  if (!(Uint8Array as any).fromHex) {
    (Uint8Array as any).fromHex = function (hex: string) {
      const bytes = new Uint8Array(hex.length / 2);
      for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
      }
      return bytes;
    };
  }
}
if (typeof Map !== "undefined" && !(Map.prototype as any).getOrInsertComputed) {
  (Map.prototype as any).getOrInsertComputed = function (key: any, callbackFn: (k: any) => any) {
    if (this.has(key)) return this.get(key);
    const val = callbackFn(key);
    this.set(key, val);
    return val;
  };
}
if (typeof Math !== "undefined" && !(Math as any).sumPrecise) {
  (Math as any).sumPrecise = function (items: Iterable<number>) {
    let sum = 0;
    for (const x of items) sum += Number(x) || 0;
    return sum;
  };
}
if (typeof (Promise as any).withResolvers === "undefined") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 2. Set worker source to static file
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

async function fetchSingleCandidate(url: string, onProgress?: (pct: number) => void): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const ctype = res.headers.get("content-type") || "";
  if (ctype.includes("text/html")) throw new Error("Received HTML response instead of PDF");

  const total = Number(res.headers.get("content-length")) || 0;
  let buf: ArrayBuffer;
  if (!res.body || total <= 0) {
    if (onProgress) onProgress(50);
    buf = await res.arrayBuffer();
    if (onProgress) onProgress(100);
  } else {
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (onProgress) onProgress(Math.min(99, Math.round((received / total) * 100)));
      }
    }
    const result = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      result.set(c, offset);
      offset += c.length;
    }
    if (onProgress) onProgress(100);
    buf = result.buffer;
  }

  if (buf.byteLength < 50000) throw new Error("PDF byte size too small");
  const magic = new Uint8Array(buf.slice(0, 4));
  // Validate %PDF (0x25, 0x50, 0x44, 0x46)
  if (magic[0] !== 0x25 || magic[1] !== 0x50 || magic[2] !== 0x44 || magic[3] !== 0x46) {
    throw new Error("Invalid PDF signature (expected %PDF)");
  }
  return buf;
}

async function fetchJuzPdf(
  juz: number,
  forceFresh: boolean = false,
  onProgress?: (pct: number) => void,
): Promise<ArrayBuffer> {
  const candidates: string[] = [
    // 1. Direct Local Edge CDN (hosted statically in public/ on Vercel's global edge, 0 latency)
    `/quran-pdfs/indopak/${juz}.pdf`,
    // 2. jsDelivr Free Global CDN mirror
    `https://cdn.jsdelivr.net/gh/Wajidalihashmi29/Islamic-Companion@Prod/frontend/public/quran-pdfs/indopak/${juz}.pdf`,
    // 3. Raw GitHub Free CDN mirror
    `https://raw.githubusercontent.com/Wajidalihashmi29/Islamic-Companion/Prod/frontend/public/quran-pdfs/indopak/${juz}.pdf`,
  ];
  const base = import.meta.env.VITE_API_BASE_URL;
  if (base && !base.startsWith("/")) {
    candidates.push(`${base.replace(/\/+$/, "")}/quran/pdf/indopak/${juz}${forceFresh ? "?refresh=true" : ""}`);
  }
  candidates.push(`/api/quran/pdf/indopak/${juz}${forceFresh ? "?refresh=true" : ""}`);
  candidates.push(`/quran-proxy/quran/juz/${juz}.pdf`);
  candidates.push(`https://islamicstudies.info/quran/juz/${juz}.pdf`);

  let lastError: any = null;
  for (const url of candidates) {
    try {
      return await fetchSingleCandidate(url, onProgress);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`Failed to load Para ${juz} from all mirrors.`);
}

const STORAGE_PAGE_KEY = "ic.quranPdfPage";
const STORAGE_JUZ_KEY = "ic.quranPdfJuz";
const STORAGE_PROMPT_KEY = "ic.quranPdfPromptAnswered";
const STORAGE_FAV_KEY = "ic.quranPdfFavorites";

const getPdfPageStorageKey = (profileKey: string) => `${profileKey}:quran-pdf-page`;
const getPdfJuzStorageKey = (profileKey: string) => `${profileKey}:quran-pdf-juz`;
const getPdfParasFavStorageKey = (profileKey: string) => `${profileKey}:quran-favorite-paras`;

const DB_NAME = "IslamicCompanion_PDF_v3";
const DB_STORE = "juz_cache";

function openJuzDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveJuzToDB(juz: number, data: ArrayBuffer): Promise<void> {
  try {
    const db = await openJuzDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.put(data, `indopak_${juz}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Unable to save Juz to IndexedDB", err);
  }
}

async function getJuzFromDB(juz: number): Promise<ArrayBuffer | null> {
  try {
    const db = await openJuzDB();
    const data: ArrayBuffer | null = await new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.get(`indopak_${juz}`);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
    if (!data || data.byteLength < 50000) return null;
    const header = new Uint8Array(data.slice(0, 4));
    // Verify genuine %PDF header
    if (header[0] !== 0x25 || header[1] !== 0x50 || header[2] !== 0x44 || header[3] !== 0x46) {
      await deleteJuzFromDB(juz);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

async function deleteJuzFromDB(juz: number): Promise<void> {
  try {
    const db = await openJuzDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readwrite");
      const store = tx.objectStore(DB_STORE);
      store.delete(`indopak_${juz}`);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Unable to delete Juz from IndexedDB", err);
  }
}

async function getSavedJuzCount(): Promise<number> {
  try {
    const db = await openJuzDB();
    return new Promise((resolve) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const store = tx.objectStore(DB_STORE);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result as string[];
        const count = keys.filter(k => typeof k === "string" && k.startsWith("indopak_")).length;
        resolve(count);
      };
      req.onerror = () => resolve(0);
    });
  } catch {
    return 0;
  }
}

export default function QuranPdfPage() {
  const navigate = useNavigate();
  const { userIdentifier } = useAuth();
  const profileKey = useMemo(() => getStorageKeyForUser(userIdentifier), [userIdentifier]);

  // Reading Position (Indo-Pak 16 Lines, independent of Reader Quran page)
  const [currentJuz, setCurrentJuz] = useState<number>(() => {
    const saved = Number(
      localStorage.getItem(getPdfJuzStorageKey(profileKey)) ||
      localStorage.getItem(STORAGE_JUZ_KEY)
    );
    return Number.isInteger(saved) && saved >= 1 && saved <= 30 ? saved : 1;
  });
  const [currentPage, setCurrentPage] = useState<number>(() => {
    const saved = Number(
      localStorage.getItem(getPdfPageStorageKey(profileKey)) ||
      localStorage.getItem(STORAGE_PAGE_KEY)
    );
    return Number.isInteger(saved) && saved >= 1 ? saved : 1;
  });
  const [numPages, setNumPages] = useState<number>(0);

  // Synchronous refs to prevent stale closure during rapid page turns / loop navigation
  const currentJuzRef = useRef(currentJuz);
  const currentPageRef = useRef(currentPage);

  useEffect(() => {
    currentJuzRef.current = currentJuz;
  }, [currentJuz]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [turnAnim, setTurnAnim] = useState<"next" | "prev" | null>(null);

  // Complete Quran Download States
  const [savedJuzCount, setSavedJuzCount] = useState<number>(0);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadAllProgress, setDownloadAllProgress] = useState<{
    active: boolean;
    currentJuz: number;
    total: number;
    percent: number;
    statusText: string;
  }>({
    active: false,
    currentJuz: 1,
    total: 30,
    percent: 0,
    statusText: "",
  });

  // Phone Controls & UI visibility
  const [showControls, setShowControls] = useState(false);
  const [showMenuDrawer, setShowMenuDrawer] = useState(false);

  // Index Drawer (Para, Surah, Favorite)
  const [showIndexDrawer, setShowIndexDrawer] = useState(false);
  const [indexTab, setIndexTab] = useState<"paras" | "surahs" | "favorites">("paras");
  const [indexSearch, setIndexSearch] = useState("");

  // Favorites state - synchronized in real-time with QuranReaderPage via profileKey
  const [favoriteSurahIds, setFavoriteSurahIds] = useState<number[]>(() => {
    try {
      return loadQuranFavoriteSurahs(profileKey);
    } catch {
      return [];
    }
  });

  const [favoriteParaIds, setFavoriteParaIds] = useState<number[]>(() => {
    try {
      const raw = localStorage.getItem(getPdfParasFavStorageKey(profileKey));
      if (raw) return JSON.parse(raw);
      const oldRaw = localStorage.getItem(STORAGE_FAV_KEY);
      if (oldRaw) {
        const parsed = JSON.parse(oldRaw);
        if (Array.isArray(parsed?.paras)) return parsed.paras;
      }
    } catch {}
    return [1, 30];
  });

  // Keep favorites in sync in real time across reader tabs and modes
  useEffect(() => {
    const syncFavorites = () => {
      try {
        setFavoriteSurahIds(loadQuranFavoriteSurahs(profileKey));
      } catch {}
      try {
        const raw = localStorage.getItem(getPdfParasFavStorageKey(profileKey));
        if (raw) setFavoriteParaIds(JSON.parse(raw));
      } catch {}
    };

    syncFavorites();

    window.addEventListener("ic:libraryUpdated", syncFavorites);
    window.addEventListener("storage", syncFavorites);
    return () => {
      window.removeEventListener("ic:libraryUpdated", syncFavorites);
      window.removeEventListener("storage", syncFavorites);
    };
  }, [profileKey]);

  // Jump to Page Dialog States
  const [showJumpDialog, setShowJumpDialog] = useState(false);
  const [jumpMode, setJumpMode] = useState<"printed" | "juz">("printed");
  const [jumpPrintedInput, setJumpPrintedInput] = useState("");
  const [jumpJuzSelect, setJumpJuzSelect] = useState<number>(1);
  const [jumpJuzPageInput, setJumpJuzPageInput] = useState("1");

  // One-time prompt state (ask once)
  const [showPrompt, setShowPrompt] = useState(() => {
    return localStorage.getItem(STORAGE_PROMPT_KEY) !== "true";
  });

  // Refs
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<any>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const errorTimeoutRef = useRef<any>(null);

  const showError = useCallback((msg: string) => {
    setErrorMessage(msg);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => {
      setErrorMessage("");
    }, 4500);
  }, []);

  const refreshSavedCount = useCallback(async () => {
    const count = await getSavedJuzCount();
    setSavedJuzCount(count);
  }, []);

  useEffect(() => {
    void refreshSavedCount();
  }, [refreshSavedCount]);

  const toggleFavoritePara = (paraNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteParaIds(prev => {
      const exists = prev.includes(paraNum);
      const nextParas = exists ? prev.filter(p => p !== paraNum) : [...prev, paraNum].sort((a, b) => a - b);
      localStorage.setItem(getPdfParasFavStorageKey(profileKey), JSON.stringify(nextParas));
      window.dispatchEvent(new Event("ic:libraryUpdated"));
      queueCloudSave();
      return nextParas;
    });
  };

  const toggleFavoriteSurah = (surahNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    let currentSurahs: number[] = [];
    try {
      currentSurahs = loadQuranFavoriteSurahs(profileKey);
    } catch {
      currentSurahs = favoriteSurahIds;
    }
    const exists = currentSurahs.includes(surahNum);
    const nextSurahs = exists
      ? currentSurahs.filter(s => s !== surahNum)
      : [...currentSurahs, surahNum].sort((a, b) => a - b);
    try {
      saveQuranFavoriteSurahs(profileKey, nextSurahs);
    } catch {}
    setFavoriteSurahIds(nextSurahs);
  };

  // Ensure browser fullscreen API is NOT active and precache PDF worker for offline reliability
  useEffect(() => {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if ("caches" in window) {
      caches.open("islamic-companion-shell-v4").then(cache => {
        cache.add("/pdf.worker.min.mjs").catch(() => {});
      }).catch(() => {});
    }
  }, []);

  // Clean navigation back to home with fullscreen exit
  const goBackToHome = useCallback(() => {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        try {
          (document as any).webkitExitFullscreen();
        } catch {}
      }
    }
    navigate("/", { replace: true });
  }, [navigate]);

  // Clean up fullscreen on unmount so home screen is never left in browser fullscreen mode
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as any).webkitExitFullscreen) {
          try {
            (document as any).webkitExitFullscreen();
          } catch {}
        }
      }
    };
  }, []);

  // Phone Back Navigation: Phone gestures or back button navigate to Home ('/') rather than exiting fullscreen
  useEffect(() => {
    window.history.pushState({ page: "quran-pdf" }, "");

    const handlePopState = () => {
      if (showIndexDrawer) {
        setShowIndexDrawer(false);
        window.history.pushState({ page: "quran-pdf" }, "");
        return;
      }
      if (showMenuDrawer) {
        setShowMenuDrawer(false);
        window.history.pushState({ page: "quran-pdf" }, "");
        return;
      }
      if (showJumpDialog) {
        setShowJumpDialog(false);
        window.history.pushState({ page: "quran-pdf" }, "");
        return;
      }
      goBackToHome();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate, goBackToHome, showIndexDrawer, showMenuDrawer, showJumpDialog]);

  // Persist reading position independently for PDF mode
  useEffect(() => {
    localStorage.setItem(getPdfPageStorageKey(profileKey), String(currentPage));
    localStorage.setItem(getPdfJuzStorageKey(profileKey), String(currentJuz));
    localStorage.setItem(STORAGE_PAGE_KEY, String(currentPage));
    localStorage.setItem(STORAGE_JUZ_KEY, String(currentJuz));
  }, [currentPage, currentJuz, profileKey]);

  // Direct, pixel-perfect render fitting complete screen edge-to-edge
  const renderPage = useCallback(
    async (doc: PDFDocumentProxy | null, pageNum: number, targetJuz?: number) => {
      if (!doc) return;
      const canvas = canvasRef.current;
      const viewportElem = viewportRef.current;
      if (!canvas || !viewportElem) return;

      try {
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const effectiveJuz = targetJuz ?? currentJuzRef.current;
        const maxAllowed = getJuzPageCount(effectiveJuz);
        const clampedPage = Math.max(1, Math.min(pageNum, Math.min(doc.numPages, maxAllowed)));
        const page = await doc.getPage(clampedPage);

        const containerW = viewportElem.clientWidth;
        const containerH = viewportElem.clientHeight;
        if (containerW < 20 || containerH < 20) return;

        // Tightly crop outer excess white margins:
        // Original page is [0, 0, 540, 756]
        // Bottom is cropped at y=48 to completely eliminate the bottom blank paper margin!
        const croppedBox = [32, 48, 508, 716];

        const boxW = croppedBox[2] - croppedBox[0];
        const boxH = croppedBox[3] - croppedBox[1];

        // Apply crop directly to PDF.js view property
        if ((page as any)._pageInfo) {
          (page as any)._pageInfo.view = croppedBox;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);

        // Calculate exact scale so the Quran page fills the entire viewport head to toe
        const scaleX = (containerW * dpr) / boxW;
        const scaleY = (containerH * dpr) / boxH;

        const baseVp = page.getViewport({ scale: 1 });
        const fittedVp = baseVp.clone({ scale: 1 });
        fittedVp.width = Math.floor(containerW * dpr);
        fittedVp.height = Math.floor(containerH * dpr);
        fittedVp.transform = [
          scaleX,
          0,
          0,
          -scaleY,
          -croppedBox[0] * scaleX,
          croppedBox[3] * scaleY,
        ];

        canvas.width = Math.floor(containerW * dpr);
        canvas.height = Math.floor(containerH * dpr);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.objectFit = "fill";

        const ctx = canvas.getContext("2d", { alpha: false });
        if (!ctx) return;

        const renderContext: any = {
          canvasContext: ctx,
          viewport: fittedVp,
          canvas,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err: any) {
        if (err?.name !== "RenderingCancelledException") {
          console.error("Render error:", err);
        }
      }
    },
    [],
  );

  // Load and cache PDF document (supports forceFresh for clean Retry)
  const loadPdfDocument = useCallback(
    async (
      targetJuz: number,
      forceFresh: boolean = false,
      targetPage: number = 1,
    ) => {
      setLoading(true);
      setErrorMessage("");

      let pdfData: ArrayBuffer | null = null;
      try {
        pdfData = forceFresh ? null : await getJuzFromDB(targetJuz);

        if (!pdfData) {
          setDownloading(true);
          setDownloadPercent(10);

          pdfData = await fetchJuzPdf(targetJuz, forceFresh, pct => {
            setDownloadPercent(pct);
          });
          await saveJuzToDB(targetJuz, pdfData);
        }

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {}
        }

        const origin = window.location.origin;
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfData),
          cMapUrl: `${origin}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `${origin}/standard_fonts/`,
          wasmUrl: `${origin}/wasm/`,
        });

        const doc = await loadingTask.promise;
        activeDocRef.current = doc;
        currentJuzRef.current = targetJuz;
        const maxAllowed = getJuzPageCount(targetJuz);
        const effectivePages = Math.min(doc.numPages, maxAllowed);
        setNumPages(effectivePages);
        const resolvedPage = Math.max(1, Math.min(targetPage, effectivePages));
        currentPageRef.current = resolvedPage;
        setCurrentPage(resolvedPage);
        setLoading(false);
        setDownloading(false);
        void refreshSavedCount();

        // Render page immediately upon load with explicit targetJuz
        void renderPage(doc, resolvedPage, targetJuz);
      } catch (err: any) {
        console.error("Failed to load PDF:", err);
        const msg = !navigator.onLine && !pdfData
          ? `Para ${targetJuz} is not downloaded yet. Connect to the internet to download it.`
          : `Unable to load Para ${targetJuz}. Tap Retry to download again.`;
        showError(msg);
        setLoading(false);
        setDownloading(false);
      }
    },
    [refreshSavedCount, showError, renderPage],
  );

  // Clean retry: removes corrupted entry from cache and forces a fresh download
  const handleRetry = async () => {
    setErrorMessage("");
    await deleteJuzFromDB(currentJuzRef.current);
    void loadPdfDocument(currentJuzRef.current, true, currentPageRef.current);
  };

  // Turn page logic
  const goToPage = useCallback(
    (targetPage: number) => {
      const juz = currentJuzRef.current;
      const maxAllowed = getJuzPageCount(juz);
      const effectiveTotal = numPages > 0 ? Math.min(numPages, maxAllowed) : maxAllowed;
      const clamped = Math.max(1, Math.min(targetPage, effectiveTotal));
      if (clamped === currentPageRef.current) return;

      const dir = clamped > currentPageRef.current ? "next" : "prev";
      setTurnAnim(dir);
      currentPageRef.current = clamped;
      setCurrentPage(clamped);
      void renderPage(activeDocRef.current, clamped, juz);

      setTimeout(() => {
        setTurnAnim(null);
      }, 300);
    },
    [numPages, renderPage],
  );

  // Switch Juz cleanly with instant load & render
  const selectJuz = useCallback(
    (targetJuz: number, targetPage: number = 1) => {
      setShowIndexDrawer(false);
      setShowMenuDrawer(false);
      if (targetJuz === currentJuzRef.current && activeDocRef.current) {
        goToPage(targetPage);
        return;
      }
      currentJuzRef.current = targetJuz;
      currentPageRef.current = targetPage;
      setCurrentJuz(targetJuz);
      setCurrentPage(targetPage);
      void loadPdfDocument(targetJuz, false, targetPage);
    },
    [goToPage, loadPdfDocument],
  );

  // Advance page with loop: end of Para 30 wraps around to Para 1 Page 1!
  const advancePage = useCallback(() => {
    const maxAllowed = getJuzPageCount(currentJuzRef.current);
    const effectiveTotal = numPages > 0 ? Math.min(numPages, maxAllowed) : maxAllowed;
    if (currentPageRef.current < effectiveTotal) {
      goToPage(currentPageRef.current + 1);
    } else if (currentJuzRef.current < 30) {
      selectJuz(currentJuzRef.current + 1, 1);
    } else {
      // Loop: Going right from last page of Para 30 takes you to first page of Para 1
      selectJuz(1, 1);
    }
  }, [numPages, goToPage, selectJuz]);

  // Retreat page with loop: going left from Para 1 Page 1 wraps to Para 30 Page 31 (Dua Khatam-ul-Qur'an)!
  const retreatPage = useCallback(() => {
    if (currentPageRef.current > 1) {
      goToPage(currentPageRef.current - 1);
    } else if (currentJuzRef.current > 1) {
      const prevJuz = currentJuzRef.current - 1;
      const prevJuzLastPage = getJuzPageCount(prevJuz);
      selectJuz(prevJuz, prevJuzLastPage);
    } else {
      // Loop: Going left from first page (Para 1, Page 1) takes you to last page of last Para (Para 30, Page 31)
      selectJuz(30, getJuzPageCount(30));
    }
  }, [goToPage, selectJuz]);

  // Initial load
  useEffect(() => {
    if (!showPrompt) {
      void loadPdfDocument(currentJuz, false, currentPage);
    }
  }, [showPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize listener
  useEffect(() => {
    const handleResize = () => {
      if (activeDocRef.current) {
        void renderPage(activeDocRef.current, currentPage);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderPage, currentPage]);

  // Download complete Quran (All 30 Juz) concurrently & fast
  const downloadCompleteQuran = async () => {
    setIsDownloadingAll(true);
    setDownloadAllProgress({
      active: true,
      currentJuz: 1,
      total: 30,
      percent: 0,
      statusText: "Starting Complete Qur'an download (All 30 Paras)…",
    });

    try {
      const allJuzNumbers = Array.from({ length: 30 }, (_, i) => i + 1);
      let completedCount = 0;
      let currentIndex = 0;
      const pool = 6;

      const worker = async () => {
        while (currentIndex < allJuzNumbers.length) {
          const j = allJuzNumbers[currentIndex++];
          try {
            const existing = await getJuzFromDB(j);
            if (!existing) {
              const data = await fetchJuzPdf(j, false);
              await saveJuzToDB(j, data);
            }
          } catch (e) {
            console.warn(`Para ${j} download issue:`, e);
          }
          completedCount++;
          const pct = Math.round((completedCount / 30) * 100);
          setDownloadAllProgress({
            active: true,
            currentJuz: j,
            total: 30,
            percent: pct,
            statusText: `Downloaded Para ${completedCount} of 30 offline (${pct}%)`,
          });
        }
      };

      await Promise.all(Array.from({ length: pool }, () => worker()));

      setDownloadAllProgress({
        active: false,
        currentJuz: 30,
        total: 30,
        percent: 100,
        statusText: "All 30 Paras of the Holy Qur'an are downloaded for 100% offline reading!",
      });
      await refreshSavedCount();
      setTimeout(() => {
        setDownloadAllProgress(p => ({ ...p, active: false, statusText: "" }));
      }, 5000);
    } catch (err) {
      console.error("Complete Quran download error:", err);
      showError("Download paused. You can resume anytime from the menu.");
    } finally {
      setIsDownloadingAll(false);
    }
  };

  // Touch Swipe Handlers:
  // Swiping Left-to-Right = Increase page (advancePage)
  // Swiping Right-to-Left = Decrease page (retreatPage)
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    if (Math.abs(dx) > 35 && Math.abs(dy) < Math.abs(dx) * 0.8 && dt < 500) {
      if (dx > 0) {
        advancePage();
      } else {
        retreatPage();
      }
    }
  };

  // Mouse drag swipe support for desktop/trackpads
  const mouseStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const didSwipeMouseRef = useRef(false);

  const onMouseDown = (e: React.MouseEvent) => {
    mouseStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    didSwipeMouseRef.current = false;
  };

  const onMouseUp = (e: React.MouseEvent) => {
    if (!mouseStartRef.current) return;
    const dx = e.clientX - mouseStartRef.current.x;
    const dy = e.clientY - mouseStartRef.current.y;
    const dt = Date.now() - mouseStartRef.current.time;
    mouseStartRef.current = null;

    if (Math.abs(dx) > 40 && Math.abs(dy) < Math.abs(dx) * 0.8 && dt < 600) {
      didSwipeMouseRef.current = true;
      if (dx > 0) {
        advancePage();
      } else {
        retreatPage();
      }
    }
  };

  // Screen Tap Handler:
  // Tapping anywhere on screen ONLY toggles the floating '...' button at bottom.
  // Clicking right/left will NEVER turn the page — page turn happens ONLY on swipe!
  const handleViewportClick = () => {
    if (didSwipeMouseRef.current) {
      didSwipeMouseRef.current = false;
      return;
    }
    setShowControls(prev => !prev);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        showPrompt ||
        showMenuDrawer ||
        showIndexDrawer ||
        showJumpDialog
      )
        return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          advancePage();
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          retreatPage();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [advancePage, retreatPage, showPrompt, showMenuDrawer, showIndexDrawer, showJumpDialog]);

  const handleAcceptPrompt = () => {
    localStorage.setItem(STORAGE_PROMPT_KEY, "true");
    setShowPrompt(false);
    void loadPdfDocument(currentJuz, false, currentPage);
  };

  const currentJuzInfo: QuranJuzInfo =
    QURAN_JUZ_LIST.find(j => j.number === currentJuz) || QURAN_JUZ_LIST[0];

  const currentPrintedPage = getPrintedPageNumber(currentJuz, currentPage);

  // Filtered lists for the Index Drawer
  const filteredParas = useMemo(() => {
    const q = indexSearch.trim().toLowerCase();
    if (!q) return QURAN_JUZ_LIST;
    return QURAN_JUZ_LIST.filter(
      j =>
        String(j.number).includes(q) ||
        j.nameEnglish.toLowerCase().includes(q) ||
        j.nameArabic.includes(q) ||
        j.startSurah.toLowerCase().includes(q),
    );
  }, [indexSearch]);

  const filteredSurahs = useMemo(() => {
    const q = indexSearch.trim().toLowerCase();
    if (!q) return QURAN_SURAHS;
    return QURAN_SURAHS.filter(
      s =>
        String(s.number).includes(q) ||
        s.nameEnglish.toLowerCase().includes(q) ||
        s.nameArabic.includes(q) ||
        s.meaning.toLowerCase().includes(q),
    );
  }, [indexSearch]);

  const favoriteParas = useMemo(() => {
    return QURAN_JUZ_LIST.filter(j => favoriteParaIds.includes(j.number));
  }, [favoriteParaIds]);

  const favoriteSurahs = useMemo(() => {
    return QURAN_SURAHS.filter(s => favoriteSurahIds.includes(s.number));
  }, [favoriteSurahIds]);

  return (
    <div className="quran-pdf-immersive-root" dir="ltr">
      {/* 1. ONE-TIME DOWNLOAD ASK DIALOG (Indo-Pak 16-Line Script) */}
      {showPrompt && (
        <div className="quran-pdf-modal-backdrop">
          <div className="quran-pdf-prompt-modal" role="dialog" aria-modal="true">
            <div className="quran-pdf-prompt-icon">
              <BookOpenText size={38} />
            </div>
            <h2>Download Holy Qur'an (Indo-Pak 16 Lines)</h2>
            <p>
              Download the authentic 16-line Tajweed Mushaf scans for 100% offline reading without internet.
            </p>

            <div className="quran-pdf-prompt-actions">
              <button
                type="button"
                className="quran-pdf-btn-primary"
                onClick={() => {
                  handleAcceptPrompt();
                  void downloadCompleteQuran();
                }}
              >
                <Download size={18} />
                <span>Download Complete Qur'an (All 30 Paras)</span>
              </button>
              <button
                type="button"
                className="quran-pdf-btn-secondary"
                onClick={() => handleAcceptPrompt()}
              >
                Download Current Para {currentJuz} Only
              </button>
              <button
                type="button"
                className="quran-pdf-btn-text"
                onClick={() => handleAcceptPrompt()}
              >
                Open Included Para 1 Instantly
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. FULLSCREEN IMMERSIVE SCREEN-FITTING VIEWPORT (Head to toe, zero top banner) */}
      <div
        className="quran-pdf-immersive-viewport"
        ref={viewportRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onClick={handleViewportClick}
      >
        {/* User-friendly Loading Screen */}
        {loading && (
          <div className="quran-pdf-center-loader">
            <div className="quran-pdf-spinner" />
            <h3>Loading Holy Qur'an…</h3>
            <p>
              {downloading
                ? `Downloading Para ${currentJuz} for offline reading (${downloadPercent}%)`
                : "Rendering page canvas…"}
            </p>
            {downloading && (
              <div className="quran-pdf-loader-bar">
                <div style={{ width: `${downloadPercent}%` }} />
              </div>
            )}
          </div>
        )}

        {/* Complete Quran Download Strip */}
        {downloadAllProgress.active && (
          <div className="quran-pdf-download-strip" onClick={e => e.stopPropagation()}>
            <div className="quran-pdf-download-strip-content">
              <div className="quran-pdf-download-strip-label">
                <Download size={15} className="quran-pdf-pulse" />
                <span>{downloadAllProgress.statusText}</span>
              </div>
              <strong className="quran-pdf-download-strip-pct">{downloadAllProgress.percent}%</strong>
            </div>
            <div className="quran-pdf-download-strip-track">
              <div
                className="quran-pdf-download-strip-fill"
                style={{ width: `${Math.max(5, downloadAllProgress.percent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Single Juz Download Bar */}
        {downloading && !downloadAllProgress.active && (
          <div className="quran-pdf-download-strip" onClick={e => e.stopPropagation()}>
            <div className="quran-pdf-download-strip-content">
              <div className="quran-pdf-download-strip-label">
                <Download size={15} className="quran-pdf-pulse" />
                <span>Downloading Para {currentJuz} for offline reading…</span>
              </div>
              <strong className="quran-pdf-download-strip-pct">{downloadPercent}%</strong>
            </div>
            <div className="quran-pdf-download-strip-track">
              <div
                className="quran-pdf-download-strip-fill"
                style={{ width: `${Math.max(5, downloadPercent)}%` }}
              />
            </div>
          </div>
        )}

        {/* Non-intrusive Floating Error Toast with Auto-Dismiss & Retry */}
        {errorMessage && !loading && (
          <div className="quran-pdf-floating-notice" onClick={e => e.stopPropagation()}>
            <span className="quran-pdf-notice-text">{errorMessage}</span>
            <div className="quran-pdf-notice-actions">
              <button type="button" onClick={() => void handleRetry()}>
                <RotateCcw size={13} /> Retry
              </button>
              <button
                type="button"
                className="quran-pdf-notice-close"
                onClick={() => setErrorMessage("")}
                aria-label="Dismiss notice"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* PDF Canvas with Smooth Turn Animation */}
        <div className={`quran-pdf-canvas-holder ${turnAnim ? `turn-${turnAnim}` : ""}`}>
          <canvas ref={canvasRef} className="quran-pdf-render-canvas" />
        </div>

        {/* 3. MINIMAL FLOATING '...' BUTTON (At the bottom of page, shown on screen tap) */}
        <button
          type="button"
          className={`quran-pdf-floating-menu-btn ${showControls ? "visible" : ""}`}
          onClick={e => {
            e.stopPropagation();
            setShowMenuDrawer(true);
          }}
          aria-label="Settings and Menu"
          title="Reader Menu"
        >
          <MoreVertical size={24} />
        </button>
      </div>

      {/* 4. SETTINGS & NAVIGATION DRAWER (Opened via '...') */}
      {showMenuDrawer && (
        <div className="quran-pdf-modal-backdrop" onClick={() => setShowMenuDrawer(false)}>
          <div
            className="quran-pdf-menu-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Settings and Navigation"
          >
            {/* Sheet Header */}
            <div className="quran-pdf-sheet-header">
              <div className="quran-pdf-sheet-title">
                <BookOpenText size={20} />
                <h3>Qur'an 16-Line Reader</h3>
              </div>
              <button
                type="button"
                className="quran-pdf-icon-close"
                onClick={() => setShowMenuDrawer(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Current Para Details */}
            <div className="quran-pdf-sheet-juz-info">
              <div>
                <strong>
                  Para {currentJuz}: <span className="arabic-lead" lang="ar">{currentJuzInfo.nameArabic}</span> ({currentJuzInfo.nameEnglish})
                </strong>
                <span>
                  Page {currentPage} of {numPages || 28} • Printed Page {currentPrintedPage} of {MAX_PRINTED_PAGE}
                </span>
              </div>
              <small>
                Starts with {currentJuzInfo.startSurah} ({currentJuzInfo.startVerse})
              </small>
            </div>

            {/* Menu Actions */}
            <div className="quran-pdf-sheet-actions">
              <button
                type="button"
                className="quran-pdf-sheet-btn"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowIndexDrawer(true);
                  setIndexTab("paras");
                }}
              >
                <Layers size={18} />
                <span>Select Para, Surah, Favorite</span>
              </button>

              <button
                type="button"
                className="quran-pdf-sheet-btn"
                onClick={() => {
                  setShowMenuDrawer(false);
                  setShowJumpDialog(true);
                  setJumpMode("printed");
                  setJumpPrintedInput(String(currentPrintedPage));
                  setJumpJuzSelect(currentJuz);
                  setJumpJuzPageInput(String(currentPage));
                }}
              >
                <BookMarked size={18} />
                <span>Jump to Page Number</span>
              </button>

              <button
                type="button"
                className="quran-pdf-sheet-btn download-all-btn"
                onClick={() => {
                  setShowMenuDrawer(false);
                  void downloadCompleteQuran();
                }}
                disabled={isDownloadingAll}
              >
                <Download size={18} />
                <div className="quran-pdf-sheet-btn-col">
                  <strong>Download Complete Qur'an (All 30 Paras)</strong>
                  <small>
                    {savedJuzCount >= 30
                      ? "✓ All 30 Paras saved & ready 100% offline"
                      : `${savedJuzCount}/30 Paras saved • Tap to download all`}
                  </small>
                </div>
              </button>

              <div className="quran-pdf-sheet-divider" />

              {/* Back to Home button */}
              <button
                type="button"
                className="quran-pdf-sheet-btn back-home"
                onClick={() => goBackToHome()}
              >
                <HomeIcon size={18} />
                <span>Back to Home Screen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. PARA / SURAH / FAVORITE INDEX MODAL (Matching QuranReaderPage) */}
      {showIndexDrawer && (
        <div className="quran-pdf-modal-backdrop" onClick={() => setShowIndexDrawer(false)}>
          <div
            className="quran-pdf-index-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Quran Index"
          >
            <div className="quran-pdf-index-header">
              <h3>Qur'an Index</h3>
              <button
                type="button"
                className="quran-pdf-icon-close"
                onClick={() => setShowIndexDrawer(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs: Para, Surah, Favorite */}
            <div className="quran-pdf-index-tabs">
              <button
                type="button"
                className={`quran-pdf-index-tab ${indexTab === "paras" ? "active" : ""}`}
                onClick={() => setIndexTab("paras")}
              >
                <Layers size={16} />
                <span>Para</span>
              </button>
              <button
                type="button"
                className={`quran-pdf-index-tab ${indexTab === "surahs" ? "active" : ""}`}
                onClick={() => setIndexTab("surahs")}
              >
                <BookOpenText size={16} />
                <span>Surah</span>
              </button>
              <button
                type="button"
                className={`quran-pdf-index-tab ${indexTab === "favorites" ? "active" : ""}`}
                onClick={() => setIndexTab("favorites")}
              >
                <Star size={16} />
                <span>Favorite</span>
              </button>
            </div>

            {/* Quick Search Bar */}
            {indexTab !== "favorites" && (
              <div className="quran-pdf-index-search">
                <Search size={16} className="quran-pdf-search-icon" />
                <input
                  type="text"
                  placeholder={indexTab === "paras" ? "Search Para name or number…" : "Search Surah name or number…"}
                  value={indexSearch}
                  onChange={e => setIndexSearch(e.target.value)}
                />
              </div>
            )}

            {/* List Content */}
            <div className="quran-pdf-index-list">
              {/* TAB 1: PARAS (JUZ 1-30) */}
              {indexTab === "paras" &&
                filteredParas.map(j => {
                  const isFav = favoriteParaIds.includes(j.number);
                  const isCurrent = currentJuz === j.number;
                  const startPage = getPrintedPageNumber(j.number, 1);
                  return (
                    <div
                      key={j.number}
                      className={`quran-pdf-index-row ${isCurrent ? "active" : ""}`}
                      onClick={() => selectJuz(j.number, 1)}
                    >
                      <div className="quran-pdf-index-row-left">
                        <span className="quran-pdf-index-badge">{j.number}</span>
                        <div className="quran-pdf-index-info">
                          <strong>{j.nameEnglish}</strong>
                          <small>
                            Starts at {j.startSurah} ({j.startVerse}) • Page {startPage}
                          </small>
                        </div>
                      </div>
                      <div className="quran-pdf-index-row-right">
                        <span className="quran-pdf-index-arabic" lang="ar">
                          {j.nameArabic}
                        </span>
                        <button
                          type="button"
                          className={`quran-pdf-star-btn ${isFav ? "is-favorite" : ""}`}
                          onClick={e => toggleFavoritePara(j.number, e)}
                          title={isFav ? "Remove favorite" : "Add to favorites"}
                        >
                          <Star size={18} fill={isFav ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {/* TAB 2: SURAHS (1-114) */}
              {indexTab === "surahs" &&
                filteredSurahs.map(s => {
                  const isFav = favoriteSurahIds.includes(s.number);
                  return (
                    <div
                      key={s.number}
                      className="quran-pdf-index-row"
                      onClick={() => selectJuz(s.juz, s.pageInJuz)}
                    >
                      <div className="quran-pdf-index-row-left">
                        <span className="quran-pdf-index-badge">{s.number}</span>
                        <div className="quran-pdf-index-info">
                          <strong>{s.nameEnglish}</strong>
                          <small>
                            {s.ayahCount} Ayahs • Para {s.juz}, Page {s.pageInJuz} (Printed {s.printedPage})
                          </small>
                        </div>
                      </div>
                      <div className="quran-pdf-index-row-right">
                        <span className="quran-pdf-index-arabic" lang="ar">
                          {s.nameArabic}
                        </span>
                        <button
                          type="button"
                          className={`quran-pdf-star-btn ${isFav ? "is-favorite" : ""}`}
                          onClick={e => toggleFavoriteSurah(s.number, e)}
                          title={isFav ? "Remove favorite" : "Add to favorites"}
                        >
                          <Star size={18} fill={isFav ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>
                  );
                })}

              {/* TAB 3: FAVORITES */}
              {indexTab === "favorites" && (
                <>
                  {favoriteParas.length === 0 && favoriteSurahs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px 16px", color: "#617d74" }}>
                      <Star size={32} style={{ opacity: 0.35, marginBottom: 8 }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>No favorites saved yet</p>
                      <small>Tap the star icon on any Para or Surah to keep it here for quick access.</small>
                    </div>
                  ) : (
                    <>
                      {favoriteParas.length > 0 && (
                        <div style={{ margin: "4px 0 8px", fontSize: "0.76rem", fontWeight: 700, color: "#145550" }}>
                          FAVORITE PARAS ({favoriteParas.length})
                        </div>
                      )}
                      {favoriteParas.map(j => (
                        <div
                          key={`fav-para-${j.number}`}
                          className="quran-pdf-index-row"
                          onClick={() => selectJuz(j.number, 1)}
                        >
                          <div className="quran-pdf-index-row-left">
                            <span className="quran-pdf-index-badge">{j.number}</span>
                            <div className="quran-pdf-index-info">
                              <strong>Para {j.number}: {j.nameEnglish}</strong>
                              <small>Starts at {j.startSurah} ({j.startVerse})</small>
                            </div>
                          </div>
                          <div className="quran-pdf-index-row-right">
                            <span className="quran-pdf-index-arabic" lang="ar">{j.nameArabic}</span>
                            <button
                              type="button"
                              className="quran-pdf-star-btn is-favorite"
                              onClick={e => toggleFavoritePara(j.number, e)}
                            >
                              <Star size={18} fill="currentColor" />
                            </button>
                          </div>
                        </div>
                      ))}

                      {favoriteSurahs.length > 0 && (
                        <div style={{ margin: "16px 0 8px", fontSize: "0.76rem", fontWeight: 700, color: "#145550" }}>
                          FAVORITE SURAHS ({favoriteSurahs.length})
                        </div>
                      )}
                      {favoriteSurahs.map(s => (
                        <div
                          key={`fav-surah-${s.number}`}
                          className="quran-pdf-index-row"
                          onClick={() => selectJuz(s.juz, s.pageInJuz)}
                        >
                          <div className="quran-pdf-index-row-left">
                            <span className="quran-pdf-index-badge">{s.number}</span>
                            <div className="quran-pdf-index-info">
                              <strong>Surah {s.nameEnglish}</strong>
                              <small>{s.ayahCount} Ayahs • Para {s.juz}, Page {s.pageInJuz} (Printed {s.printedPage})</small>
                            </div>
                          </div>
                          <div className="quran-pdf-index-row-right">
                            <span className="quran-pdf-index-arabic" lang="ar">{s.nameArabic}</span>
                            <button
                              type="button"
                              className="quran-pdf-star-btn is-favorite"
                              onClick={e => toggleFavoriteSurah(s.number, e)}
                            >
                              <Star size={18} fill="currentColor" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. JUMP TO PAGE MODAL (Horizontally centered above mobile numpad, exact printed page mapping) */}
      {showJumpDialog && (
        <div className="quran-pdf-modal-backdrop for-jump" dir="ltr" onClick={() => setShowJumpDialog(false)}>
          <form
            className="quran-pdf-jump-dialog"
            dir="ltr"
            onClick={e => e.stopPropagation()}
            onSubmit={e => {
              e.preventDefault();
              if (jumpMode === "printed") {
                const p = parseInt(jumpPrintedInput, 10);
                if (!isNaN(p) && p >= MIN_PRINTED_PAGE && p <= MAX_PRINTED_PAGE) {
                  const { juz: tJuz, page: tPage } = mapPrintedPageToJuz(p);
                  selectJuz(tJuz, tPage);
                  setShowJumpDialog(false);
                } else if (!isNaN(p) && p === 1) {
                  selectJuz(1, 1);
                  setShowJumpDialog(false);
                }
              } else {
                const p = parseInt(jumpJuzPageInput, 10);
                const maxInJuz = getJuzPageCount(jumpJuzSelect);
                if (!isNaN(p) && p >= 1 && p <= maxInJuz) {
                  selectJuz(jumpJuzSelect, p);
                  setShowJumpDialog(false);
                }
              }
            }}
          >
            <h4>Jump to Page</h4>

            <div className="quran-pdf-jump-tabs">
              <button
                type="button"
                className={`quran-pdf-jump-tab ${jumpMode === "printed" ? "active" : ""}`}
                onClick={() => setJumpMode("printed")}
              >
                Printed Page ({MIN_PRINTED_PAGE}–{MAX_PRINTED_PAGE})
              </button>
              <button
                type="button"
                className={`quran-pdf-jump-tab ${jumpMode === "juz" ? "active" : ""}`}
                onClick={() => setJumpMode("juz")}
              >
                By Para (1–30)
              </button>
            </div>

            {jumpMode === "printed" ? (
              <>
                <p>Enter Qur'an printed page number ({MIN_PRINTED_PAGE} to {MAX_PRINTED_PAGE}):</p>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={1}
                  max={MAX_PRINTED_PAGE}
                  value={jumpPrintedInput}
                  onChange={e => setJumpPrintedInput(e.target.value)}
                  placeholder="e.g. 25, 840"
                  autoFocus
                />
                {(() => {
                  const parsed = parseInt(jumpPrintedInput, 10);
                  if (!isNaN(parsed) && parsed >= 1 && parsed <= MAX_PRINTED_PAGE) {
                    const mapped = mapPrintedPageToJuz(parsed);
                    const info = QURAN_JUZ_LIST[mapped.juz - 1];
                    return (
                      <div className="quran-pdf-jump-hint">
                        Page {parsed} is in Para {mapped.juz} ({info?.nameArabic} - {info?.nameEnglish})
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            ) : (
              <>
                <p>Select Para and page number within that Para:</p>
                <div className="quran-pdf-jump-row">
                  <div className="quran-pdf-jump-field" style={{ flex: 1.4 }}>
                    <label>Select Para:</label>
                    <select
                      value={jumpJuzSelect}
                      onChange={e => {
                        const j = parseInt(e.target.value, 10);
                        setJumpJuzSelect(j);
                        setJumpJuzPageInput("1");
                      }}
                    >
                      {QURAN_JUZ_LIST.map(j => (
                        <option key={j.number} value={j.number}>
                          Para {j.number} - {j.nameArabic} ({j.nameEnglish})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="quran-pdf-jump-field" style={{ flex: 0.8 }}>
                    <label>Page (1–{getJuzPageCount(jumpJuzSelect)}):</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      min={1}
                      max={getJuzPageCount(jumpJuzSelect)}
                      value={jumpJuzPageInput}
                      onChange={e => setJumpJuzPageInput(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
              </>
            )}

            <div className="quran-pdf-jump-actions">
              <button type="submit" className="quran-pdf-btn-primary">
                Go to Page
              </button>
              <button
                type="button"
                className="quran-pdf-btn-secondary"
                onClick={() => setShowJumpDialog(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
