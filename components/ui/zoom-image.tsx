"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

/**
 * Cursor-follow "zoom on hover" for a product image. Renders an absolute-fill
 * layer that lives inside an existing `position: relative; overflow: hidden`
 * frame, so callers keep their own aspect-ratio / radius / border. On mouse
 * hover the image scales up and pans so the magnified region tracks the cursor
 * (the e-commerce standard). Mouse-only (touch/pen are left untouched) and a
 * no-op under `prefers-reduced-motion`.
 */
export function ZoomImage({
  src,
  alt,
  sizes,
  priority,
  zoom = 2,
  objectFit = "cover",
}: {
  src: string;
  alt: string;
  sizes?: string;
  priority?: boolean;
  /** Magnification factor applied on hover. */
  zoom?: number;
  objectFit?: React.CSSProperties["objectFit"];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // `origin` is the transform-origin under the cursor while zoomed; null = idle.
  const [origin, setOrigin] = useState<string | null>(null);

  function onMove(e: React.PointerEvent) {
    if (reduce || e.pointerType !== "mouse") return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(
      100,
      Math.max(0, ((e.clientX - r.left) / r.width) * 100),
    );
    const y = Math.min(
      100,
      Math.max(0, ((e.clientY - r.top) / r.height) * 100),
    );
    setOrigin(`${x}% ${y}%`);
  }

  const zoomed = origin !== null;

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setOrigin(null)}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: reduce ? undefined : "zoom-in",
      }}
    >
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        draggable={false}
        style={{
          objectFit,
          transform: zoomed ? `scale(${zoom})` : "scale(1)",
          transformOrigin: origin ?? "center",
          transition: "transform 240ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }}
      />
    </div>
  );
}
