import { useEffect, useRef } from "react";

interface ConfettiEffectProps {
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  vx: number;
  vy: number;
  rotation: number;
  vRotation: number;
  oscillationSpeed: number;
  oscillationDistance: number;
  opacity: number;
  shape: "rect" | "circle";
}

const CONFETTI_COLORS = [
  "#e0b84f", // Warm Gold
  "#145550", // Deep Islamic Teal
  "#2a9d8f", // Emerald
  "#f4a261", // Warm Coral
  "#e76f51", // Amber
  "#d4af37", // Metallic Gold
  "#52b788", // Fresh Mint
];

export default function ConfettiEffect({ onComplete }: ConfettiEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onCompleteRef.current?.();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    const particles: Particle[] = [];
    const count = 55;
    const centerX = width / 2;
    const startY = height * 0.55;

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      const speed = 7 + Math.random() * 9;
      particles.push({
        x: centerX + (Math.random() - 0.5) * 140,
        y: startY + (Math.random() - 0.5) * 40,
        width: 8 + Math.random() * 6,
        height: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rotation: Math.random() * 360,
        vRotation: (Math.random() - 0.5) * 12,
        oscillationSpeed: 0.05 + Math.random() * 0.08,
        oscillationDistance: 1 + Math.random() * 2,
        opacity: 1,
        shape: Math.random() > 0.4 ? "rect" : "circle",
      });
    }

    let animationFrame = 0;
    const startTime = performance.now();
    const duration = 2600;

    const render = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);

      ctx.clearRect(0, 0, width, height);

      particles.forEach(p => {
        p.x += p.vx + Math.sin(elapsed * p.oscillationSpeed) * p.oscillationDistance;
        p.y += p.vy;
        p.vy += 0.22;
        p.vx *= 0.985;
        p.rotation += p.vRotation;

        if (progress > 0.6) {
          p.opacity = Math.max(0, 1 - (progress - 0.6) / 0.4);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;

        if (p.shape === "rect") {
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.width / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });

      if (progress < 1) {
        animationFrame = requestAnimationFrame(render);
      } else {
        onCompleteRef.current?.();
      }
    };

    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="ptv-confetti-canvas"
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
}
