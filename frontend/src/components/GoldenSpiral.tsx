interface GoldenSpiralProps {
  className?: string;
  /** Draw the Fibonacci square grid behind the spiral. */
  showGrid?: boolean;
}

/**
 * Decorative golden spiral drawn over a 144 × 89 golden rectangle,
 * subdivided into Fibonacci squares 89, 55, 34, 21, 13, 8, 5, 3.
 * Purely ornamental — hidden from assistive tech.
 */
export default function GoldenSpiral({ className, showGrid = true }: GoldenSpiralProps) {
  return (
    <svg
      className={className}
      viewBox="-1 -1 146 91"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      {showGrid && (
        <g strokeWidth="0.25" opacity="0.55">
          <rect x="0" y="0" width="144" height="89" />
          <rect x="0" y="0" width="89" height="89" />
          <rect x="89" y="0" width="55" height="55" />
          <rect x="110" y="55" width="34" height="34" />
          <rect x="89" y="68" width="21" height="21" />
          <rect x="89" y="55" width="13" height="13" />
          <rect x="102" y="55" width="8" height="8" />
          <rect x="105" y="63" width="5" height="5" />
        </g>
      )}
      <path
        strokeWidth="0.6"
        strokeLinecap="round"
        d="M0 89 A89 89 0 0 1 89 0 A55 55 0 0 1 144 55 A34 34 0 0 1 110 89 A21 21 0 0 1 89 68 A13 13 0 0 1 102 55 A8 8 0 0 1 110 63 A5 5 0 0 1 105 68 A3 3 0 0 1 102 65"
      />
    </svg>
  );
}
