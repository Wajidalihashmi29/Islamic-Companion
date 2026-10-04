import { useId } from "react";

interface BrandMarkProps {
  /** Rendered size in px. Use Fibonacci sizes (21, 34, 55, 89) to stay on the φ scale. */
  size?: number;
  /** "tile" draws the teal rounded-square background; "plain" inherits currentColor. */
  variant?: "tile" | "plain";
  className?: string;
}

/**
 * Islamic Companion emblem, constructed entirely from golden-ratio proportions.
 * Each element is φ⁻¹ (0.618) the size of the one enclosing it:
 *
 *   tile half-width 50 → star radius 30.9 → ring radius 19.1 → crescent 11.8 → crescent offset 7.3
 *
 * The star is a Rub el Hizb (two overlapping squares), a classic Islamic motif.
 */
export default function BrandMark({ size = 34, variant = "tile", className }: BrandMarkProps) {
  const maskId = useId();
  const gradId = useId();

  const R_STAR = 30.9;                 // 50 × φ⁻¹
  const R_RING = 19.1;                 // 30.9 × φ⁻¹
  const R_MOON = 11.8;                 // 19.1 × φ⁻¹
  const MOON_OFFSET = 7.3;             // 11.8 × φ⁻¹
  const half = (R_STAR * Math.SQRT2) / 2; // half the side of a square inscribed at R_STAR
  const side = half * 2;

  const isTile = variant === "tile";
  const stroke = isTile ? "#e3c878" : "currentColor";

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Islamic Companion"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#145550" />
          <stop offset="1" stopColor="#0a2c2a" />
        </linearGradient>
        <mask id={maskId}>
          <rect width="100" height="100" fill="white" />
          <circle cx={50 + MOON_OFFSET} cy={50 - MOON_OFFSET * 0.382} r={R_MOON * 0.854} fill="black" />
        </mask>
      </defs>

      {isTile && <rect width="100" height="100" rx="23.6" fill={`url(#${gradId})`} />}

      <g fill="none" stroke={stroke} strokeWidth="3.4" strokeLinejoin="round">
        <rect x={50 - half} y={50 - half} width={side} height={side} />
        <rect x={50 - half} y={50 - half} width={side} height={side} transform="rotate(45 50 50)" />
        <circle cx="50" cy="50" r={R_RING} strokeWidth="2.1" opacity="0.618" />
      </g>

      <circle cx="50" cy="50" r={R_MOON} fill={stroke} mask={`url(#${maskId})`} />
    </svg>
  );
}
