export interface AyahMedallionProps {
  number: string | number;
  size?: number;
  className?: string;
  isIndoPak?: boolean;
}

// Convert any Arabic/Latin digits to authentic Urdu / Indo-Pak digits (Extended Arabic-Indic)
export function toUrduDigits(val: string | number): string {
  const urduDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(val)
    .replace(/[0-9]/g, (d) => urduDigits[Number(d)])
    .replace(/[٠-٩]/g, (d) => urduDigits[d.charCodeAt(0) - 0x0660])
    .replace(/[۰-۹]/g, (d) => urduDigits[d.charCodeAt(0) - 0x06f0]);
}

// Convert to authentic standard Arabic (Uthmani) digits
export function toArabicDigits(val: string | number): string {
  const arabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return String(val)
    .replace(/[0-9]/g, (d) => arabicDigits[Number(d)])
    .replace(/[۰-۹]/g, (d) => arabicDigits[d.charCodeAt(0) - 0x06f0])
    .replace(/[٠-٩]/g, (d) => arabicDigits[d.charCodeAt(0) - 0x0660]);
}

/**
 * Exact vector path of the authentic U+06DD ARABIC END OF AYAH cartouche
 * Normalized to 100x100 viewBox with central aperture at (50, 50)
 */
const AYAH_END_PATH =
  "M88.8 34.6 L89.4 37.1 L90.6 38.3 L90.6 40.2 L91.2 40.2 L91.8 46.3 L92.5 46.3 L92.5 55.5 L91.8 55.5 L91.2 61.7 L90.6 61.7 L90.6 63.5 L89.4 64.8 L89.4 66.6 L88.8 66.6 L87.5 70.3 L84.5 73.4 L84.5 74.6 L80.2 78.9 L78.9 78.9 L77.1 81.4 L75.8 81.4 L75.2 82.6 L74.0 82.6 L74.0 83.2 L72.8 83.2 L72.8 83.8 L69.7 85.1 L72.2 88.2 L66.0 88.2 L66.0 88.8 L64.2 88.8 L64.2 89.4 L62.3 89.4 L62.3 90.0 L60.5 90.0 L60.5 90.6 L53.7 91.2 L53.7 93.1 L51.8 94.9 L50.0 94.9 L48.8 93.7 L48.2 91.2 L44.5 91.2 L44.5 90.6 L39.5 90.0 L39.5 89.4 L36.5 88.8 L36.5 88.2 L30.3 88.2 L30.3 86.9 L31.5 85.7 L32.8 85.7 L32.8 85.1 L29.1 83.8 L28.5 82.6 L27.2 82.6 L25.4 80.8 L24.2 80.8 L22.3 78.3 L21.1 78.3 L18.6 75.8 L18.6 74.6 L16.2 72.8 L16.2 71.5 L14.9 70.9 L14.9 69.7 L14.3 69.7 L14.3 68.5 L13.7 68.5 L13.7 67.2 L13.1 67.2 L13.1 66.0 L11.8 64.8 L11.8 62.9 L11.2 62.9 L11.2 61.1 L10.6 61.1 L10.6 58.0 L10.0 58.0 L10.0 53.1 L9.4 53.1 L10.0 43.8 L10.6 43.8 L10.6 40.8 L11.2 40.8 L11.8 37.1 L12.5 37.1 L14.9 30.9 L16.2 30.3 L16.2 29.1 L18.6 27.2 L18.6 26.0 L21.1 23.5 L22.3 23.5 L24.2 21.1 L25.4 21.1 L26.0 19.8 L28.5 19.2 L29.1 18.0 L32.8 16.8 L32.8 16.2 L31.5 16.2 L30.3 14.9 L30.3 13.7 L36.5 13.7 L36.5 13.1 L38.3 13.1 L39.5 11.8 L42.0 11.8 L42.0 11.2 L44.5 11.2 L44.5 10.6 L48.2 10.6 L48.2 9.4 L48.8 9.4 L48.8 8.2 L50.0 6.9 L51.8 6.9 L53.7 8.8 L53.7 10.6 L58.0 10.6 L58.0 11.2 L60.5 11.2 L60.5 11.8 L62.3 11.8 L62.3 12.5 L64.2 12.5 L64.2 13.1 L66.0 13.1 L66.0 13.7 L72.2 13.7 L69.7 16.8 L72.8 18.0 L72.8 18.6 L74.0 18.6 L74.6 19.8 L77.1 20.5 L78.9 22.9 L80.2 22.9 L84.5 27.2 L84.5 28.5 L86.3 29.7 L86.3 30.9 L87.5 31.5 L88.8 34.6 Z " +
  "M84.5 67.8 L85.7 66.6 L86.9 62.9 L87.5 62.9 L87.5 61.1 L88.2 61.1 L88.2 59.2 L88.8 59.2 L88.8 56.8 L89.4 56.8 L89.4 45.1 L88.8 45.1 L88.2 40.2 L87.5 40.2 L85.1 34.0 L83.2 32.8 L83.2 31.5 L79.5 27.8 L78.3 27.8 L77.1 26.0 L75.8 26.0 L75.2 24.8 L72.2 24.2 L70.9 22.9 L68.5 22.9 L68.5 22.3 L62.3 22.3 L62.3 22.9 L60.5 22.9 L60.5 18.6 L59.8 18.0 L55.5 18.0 L53.7 19.8 L53.7 21.1 L55.5 22.9 L55.5 25.4 L51.8 29.1 L50.0 29.1 L50.0 28.5 L48.8 28.5 L46.9 26.6 L46.3 22.9 L46.9 22.9 L46.9 21.7 L48.8 19.8 L47.5 18.6 L46.3 18.6 L46.3 18.0 L42.6 18.0 L41.4 19.2 L41.4 22.3 L42.0 22.9 L40.2 22.9 L40.2 22.3 L33.4 22.3 L33.4 22.9 L29.7 23.5 L29.7 24.2 L26.0 25.4 L25.4 26.6 L24.2 26.6 L22.3 29.1 L21.1 29.1 L20.5 30.9 L18.0 32.8 L18.0 34.0 L16.8 34.6 L16.8 35.8 L14.9 37.7 L14.9 39.5 L14.3 39.5 L14.3 41.4 L13.7 41.4 L13.7 43.2 L13.1 43.2 L13.1 46.3 L12.5 46.3 L12.5 55.5 L13.1 55.5 L13.1 58.6 L13.7 58.6 L14.3 62.3 L14.9 62.3 L16.8 67.2 L18.0 67.8 L18.0 69.1 L23.5 74.6 L24.8 74.6 L25.4 75.8 L26.6 75.8 L28.5 77.7 L30.3 77.7 L31.5 78.9 L34.6 78.9 L34.6 79.5 L42.0 78.9 L41.4 79.5 L41.4 82.6 L42.6 83.8 L45.7 83.8 L45.7 83.2 L46.9 83.2 L48.8 81.4 L48.8 80.8 L46.9 80.2 L46.3 76.5 L50.6 72.2 L52.5 72.8 L54.9 75.2 L54.9 76.5 L55.5 76.5 L55.5 78.9 L53.7 80.8 L53.7 82.0 L54.9 83.2 L56.2 83.2 L56.2 83.8 L59.2 83.8 L59.2 83.2 L60.5 83.2 L60.5 78.9 L67.8 79.5 L67.8 78.9 L72.2 78.3 L72.2 77.7 L75.8 76.5 L76.5 75.2 L77.7 75.2 L78.9 73.4 L80.2 73.4 L84.5 67.8 Z " +
  "M54.3 16.2 L54.3 15.5 L58.6 14.9 L58.6 14.3 L58.0 13.7 L53.7 13.7 L53.7 14.3 L52.5 14.3 L51.8 9.4 L50.0 10.0 L50.0 11.8 L49.4 11.8 L50.0 14.9 L48.2 14.3 L48.2 13.7 L43.8 13.7 L43.8 14.9 L46.3 14.9 L46.3 15.5 L48.8 16.2 L50.6 18.6 L52.5 16.8 L54.3 16.2 Z " +
  "M53.7 88.2 L58.0 88.2 L58.6 86.9 L54.3 86.3 L51.2 83.2 L48.8 85.7 L47.5 85.7 L46.3 86.9 L43.8 86.9 L43.8 88.2 L48.2 88.2 L48.2 87.5 L50.0 86.9 L49.4 90.0 L50.0 90.0 L50.6 92.5 L51.8 92.5 L52.5 87.5 L53.7 87.5 L53.7 88.2 Z " +
  "M51.2 26.6 L52.5 25.4 L52.5 22.3 L50.0 21.7 L49.4 22.3 L49.4 25.4 L50.0 25.4 L50.0 26.6 L51.2 26.6 Z " +
  "M52.5 78.9 L52.5 75.8 L50.0 75.2 L49.4 75.8 L49.4 78.9 L50.6 80.2 L52.5 78.9 Z";

export default function AyahMedallion({
  number,
  size = 50,
  className = "",
  isIndoPak = true,
}: AyahMedallionProps) {
  const displayNum = isIndoPak ? toUrduDigits(number) : toArabicDigits(number);

  const numLength = displayNum.length;
  // Scaled font size filling the central circle boldly
  const svgFontSize = numLength >= 3 ? 28 : numLength === 2 ? 38 : 48;
  const yOffset = isIndoPak ? 49 : 50;

  const fontFamily = isIndoPak
    ? "'IndopakNastaleeq', 'AlQuran IndoPak by QuranWBW', 'Jameel Noori Nastaleeq', 'Noto Nastaliq Urdu', serif"
    : "'Amiri', 'Amiri Quran', serif";

  return (
    <span
      className={`ayah-marker-wrapper ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        verticalAlign: "middle",
        width: `${size}px`,
        height: `${size}px`,
        margin: "0 0.35em",
        flexShrink: 0,
        userSelect: "none",
        direction: "ltr",
      }}
      title={`Ayah ${displayNum}`}
      aria-label={`Ayah ${displayNum}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          overflow: "visible",
          userSelect: "none",
        }}
      >
        <defs>
          <linearGradient id="ayahEndGoldGrad" x1="10" y1="10" x2="90" y2="90" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#e8cc75" />
            <stop offset="45%" stopColor="#c59b27" />
            <stop offset="85%" stopColor="#ad8218" />
            <stop offset="100%" stopColor="#87630e" />
          </linearGradient>
        </defs>

        {/* The authentic U+06DD Arabesque Ayah End Cartouche Path */}
        <path
          d={AYAH_END_PATH}
          fill="url(#ayahEndGoldGrad)"
          fillRule="evenodd"
        />

        {/* Center aperture circular backing */}
        <circle
          cx="50"
          cy="50"
          r="26.5"
          fill="#fdfbf7"
          opacity="0.95"
        />

        {/* Verse Number rendered directly on the SVG canvas at exact center (50, 50) */}
        <text
          x="50"
          y={yOffset}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0f3d3a"
          fontFamily={fontFamily}
          fontSize={svgFontSize}
          fontWeight="bold"
          style={{
            direction: "ltr",
            userSelect: "none",
          }}
        >
          {displayNum}
        </text>
      </svg>
    </span>
  );
}

// Named alias matching user's component name
export const AyahMarker = AyahMedallion;
