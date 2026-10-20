import { forwardRef } from "react";
import type { LucideProps } from "lucide-react";

const TasbeehIcon = forwardRef<SVGSVGElement, LucideProps>(({
  color = "currentColor",
  size = 24,
  strokeWidth = 2,
  className,
  ...props
}, ref) => (
  <svg
    ref={ref}
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    color={color}
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={["lucide", "lucide-tasbeeh", className].filter(Boolean).join(" ")}
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="3.4" r="1" />
    <circle cx="8.5" cy="4.2" r="1" />
    <circle cx="5.8" cy="6.5" r="1" />
    <circle cx="4.5" cy="9.8" r="1" />
    <circle cx="5" cy="13.2" r="1" />
    <circle cx="7.2" cy="16" r="1" />
    <circle cx="16.8" cy="16" r="1" />
    <circle cx="19" cy="13.2" r="1" />
    <circle cx="19.5" cy="9.8" r="1" />
    <circle cx="18.2" cy="6.5" r="1" />
    <circle cx="15.5" cy="4.2" r="1" />
    <path d="M8.2 17.5c1.1.7 2.4 1.1 3.8 1.1s2.7-.4 3.8-1.1" />
    <path d="M12 18.6v2.1" />
    <path d="m10.7 22 1.3-1.3 1.3 1.3" />
  </svg>
));

TasbeehIcon.displayName = "TasbeehIcon";

export default TasbeehIcon;
