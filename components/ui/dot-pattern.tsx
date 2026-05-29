import { CSSProperties } from "react";

type Fade = "radial" | "left" | "right" | "top" | "bottom" | "none";

const MASKS: Record<Fade, string | undefined> = {
  radial: "radial-gradient(circle at center, #000 0%, transparent 72%)",
  left: "linear-gradient(90deg, #000, transparent 70%)",
  right: "linear-gradient(270deg, #000, transparent 70%)",
  top: "linear-gradient(180deg, #000, transparent 70%)",
  bottom: "linear-gradient(0deg, #000, transparent 70%)",
  none: undefined,
};

/**
 * DotPattern — the SPIBER brand dot-motif (echoes the logo mark + hero DotGrid)
 * as a lightweight, decorative background device. Pure CSS radial-gradient, no
 * canvas/JS, so it's cheap to drop behind section content.
 */
export function DotPattern({
  color = "var(--teal-200)",
  dotSize = 1.4,
  gap = 16,
  fade = "radial",
  className,
  style,
}: {
  color?: string;
  dotSize?: number;
  gap?: number;
  fade?: Fade;
  className?: string;
  style?: CSSProperties;
}) {
  const mask = MASKS[fade];
  return (
    <div
      aria-hidden
      className={className}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        backgroundImage: `radial-gradient(${color} ${dotSize}px, transparent ${dotSize}px)`,
        backgroundSize: `${gap}px ${gap}px`,
        WebkitMaskImage: mask,
        maskImage: mask,
        ...style,
      }}
    />
  );
}
