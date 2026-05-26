"use client";

import { useEffect, useRef } from "react";

/**
 * useMagnetic — cursor-tracked translate within an envelope.
 *
 * Attach the returned ref to a button/element. While the pointer is within
 * `radius` of the element's centre, the element translates by `strength *
 * cursor-offset`, snapping back when the pointer leaves. Pure CSS transform
 * + rAF for the duration of the gesture — no React re-renders.
 */
export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(
  strength = 0.35,
  radius = 110
) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius + Math.max(r.width, r.height)) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
        });
      }
    };
    const onLeave = () => {
      cancelAnimationFrame(raf);
      el.style.transition = "transform 600ms cubic-bezier(.16,1,.3,1)";
      el.style.transform = "translate(0,0)";
      setTimeout(() => {
        el.style.transition = "transform 200ms cubic-bezier(.16,1,.3,1)";
      }, 600);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    el.style.transition = "transform 200ms cubic-bezier(.16,1,.3,1)";
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      cancelAnimationFrame(raf);
    };
  }, [strength, radius]);
  return ref;
}
