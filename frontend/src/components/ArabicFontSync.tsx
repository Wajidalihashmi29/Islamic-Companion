import { useEffect } from "react";
import { loadSettings } from "../utils/settingsStorage";

const FONT_BY_SCRIPT = {
  indopak: '"Digital Khatt IndoPak", "IndopakNastaleeq", "AlQuran IndoPak by QuranWBW", serif',
  uthmani: '"Amiri Quran", "Traditional Arabic", serif',
} as const;

export default function ArabicFontSync() {
  useEffect(() => {
    const apply = () => {
      const script = loadSettings().quran.arabicScript;
      document.documentElement.style.setProperty("--font-arabic", FONT_BY_SCRIPT[script]);
      document.documentElement.dataset.arabicScript = script;
    };
    apply();
    window.addEventListener("ic:settingsUpdated", apply);
    return () => window.removeEventListener("ic:settingsUpdated", apply);
  }, []);
  return null;
}
