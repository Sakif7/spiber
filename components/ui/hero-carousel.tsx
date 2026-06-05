"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";

/**
 * Crossfading hero background. Renders as two absolutely-positioned siblings
 * (no wrapping stacking context) so the parent's overlay layers sit correctly
 * above the images while the indicator dots stay clickable on top. Images use
 * object-cover, centered, so they fill the band without distortion.
 */
export function HeroCarousel({
  images,
  alt = "",
  intervalMs = 5000,
}: {
  images: string[];
  alt?: string;
  intervalMs?: number;
}) {
  const reduce = useReducedMotion() ?? false;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce || images.length < 2) return;
    const id = window.setInterval(
      () => setIdx((i) => (i + 1) % images.length),
      intervalMs,
    );
    return () => window.clearInterval(id);
  }, [reduce, images.length, intervalMs]);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, zIndex: -2 }}>
        {images.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt={i === 0 ? alt : ""}
            fill
            priority={i === 0}
            sizes="100vw"
            style={{
              objectFit: "cover",
              objectPosition: "center",
              opacity: i === idx ? 1 : 0,
              transition: "opacity 900ms ease-in-out",
            }}
          />
        ))}
      </div>
      {images.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 18,
            right: 24,
            zIndex: 3,
            display: "flex",
            gap: 8,
          }}
        >
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show slide ${i + 1}`}
              aria-current={i === idx}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 22 : 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                padding: 0,
                cursor: "pointer",
                background: i === idx ? "#fff" : "rgba(255,255,255,0.55)",
                boxShadow: "0 1px 3px rgba(7,23,33,0.4)",
                transition: "width 300ms, background 300ms",
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
