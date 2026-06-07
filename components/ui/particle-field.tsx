"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  a: number;
};

/**
 * Lightweight floating-dot field on a <canvas> — drifting points, no connecting
 * lines. Sized to its (positioned) parent via ResizeObserver, crisp on HiDPI,
 * decorative (aria-hidden), and accessibility-safe: honors
 * prefers-reduced-motion by drawing a single static frame.
 *
 * `fade="left"` concentrates the dots in the left zone and fades them out
 * toward the right — so over a photo hero they sit on the teal overlay and
 * disappear before the photo. Dependency-free on purpose (the codebase favours
 * small bespoke visuals over heavy libs like particles.js / tsparticles).
 */
export function ParticleField({
  color = "255,255,255",
  density = 0.00008,
  speed = 0.2,
  maxOpacity = 0.6,
  fade = "none",
}: {
  /** "r,g,b" channel string. */
  color?: string;
  /** Dots per square pixel (of the populated zone). */
  density?: number;
  /** Drift speed multiplier. */
  speed?: number;
  /** Peak dot opacity. */
  maxOpacity?: number;
  /** "left" → dots confined to + denser on the left, fading out to the right. */
  fade?: "none" | "left";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Left zone spans this fraction of the width; alpha stays full until
    // FULL_FRAC of the zone, then fades to 0 at its right edge (soft boundary).
    const ZONE = fade === "left" ? 0.6 : 1;
    const FULL_FRAC = 0.42;

    let raf = 0;
    let w = 0;
    let h = 0;
    let bound = 0;
    let particles: Particle[] = [];

    const rand = (min: number, max: number) =>
      min + Math.random() * (max - min);

    const seed = () => {
      bound = w * ZONE;
      const count = Math.min(
        160,
        Math.max(16, Math.floor(bound * h * density)),
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * bound,
        y: Math.random() * h,
        vx: rand(-speed, speed),
        vy: rand(-speed, speed),
        r: rand(0.6, 1.9),
        a: rand(0.45, 1),
      }));
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    const edgeAlpha = (x: number) => {
      if (fade !== "left") return 1;
      const t = x / bound; // 0..1 within the left zone
      if (t <= FULL_FRAC) return 1;
      return Math.max(0, 1 - (t - FULL_FRAC) / (1 - FULL_FRAC));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        const alpha = maxOpacity * p.a * edgeAlpha(p.x);
        if (alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(${color},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > bound) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduced) draw();
      else raf = requestAnimationFrame(step);
    };

    resize();
    start();

    const ro = new ResizeObserver(() => {
      resize();
      start();
    });
    ro.observe(parent);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced, color, density, speed, maxOpacity, fade]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
