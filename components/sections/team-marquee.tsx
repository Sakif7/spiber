"use client";

/**
 * Homepage rendition of the managing body — a continuous, DRAGGABLE marquee
 * that fades out on both sides. Rebuilt (2026-08-27) as a JS-driven track
 * (rAF + pointer events) replacing the CSS-keyframe version: dragging needs
 * imperative control of the offset anyway, and one loop cleanly owns
 * auto-scroll, hover/focus pause, and drag momentum.
 *
 * - Auto-scrolls left; wraps seamlessly (two passes, offset modulo one pass).
 * - Pauses while the mouse is over it (the card 3D reveal stays usable) and
 *   while any card content holds keyboard focus.
 * - Drag with mouse or touch; a flick keeps gliding with decaying momentum.
 *   A real drag (>6px) swallows the click so cards aren't activated by it.
 * - The duplicate pass is `inert` + aria-hidden — AT/tab order see six
 *   people, not twelve.
 * - prefers-reduced-motion: no animation at all — a plain scrollable rail.
 *
 * All per-frame values live in refs and the transform is written directly to
 * the DOM — no React state updates while animating or dragging.
 */
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useTeamMembers, TeamCard } from "@/components/sections/team-grid";

const CARD_W = 232;
const GAP = 16;
/** Auto-scroll speed, px/s (≈ the old 45s CSS loop). */
const SPEED = 34;
/** Momentum decay rate (higher = stops sooner). */
const FRICTION = 3.2;
const MAX_FLICK = 2400;

const MARQUEE_CSS = `
.team-marquee {
  overflow: hidden;
  padding: 12px 0 20px;
  cursor: grab;
  touch-action: pan-y;
  user-select: none;
  -webkit-user-select: none;
  mask-image: linear-gradient(90deg, transparent, #000 90px, #000 calc(100% - 90px), transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 90px, #000 calc(100% - 90px), transparent);
}
.team-marquee[data-dragging="true"] { cursor: grabbing; }
.team-marquee-track {
  display: flex;
  width: max-content;
  will-change: transform;
}
.team-marquee-pass {
  display: flex;
  gap: ${GAP}px;
  padding-right: ${GAP}px;
  flex-shrink: 0;
  perspective: 1400px;
}
.team-marquee-card {
  flex: 0 0 ${CARD_W}px;
  width: ${CARD_W}px;
  min-width: 0;
}
.team-marquee-static {
  display: flex;
  gap: ${GAP}px;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 12px 0 20px;
}
`;

function subscribeReducedMotion(cb: () => void) {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function TeamMarquee() {
  const team = useTeamMembers();
  const reduced = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const passRef = useRef<HTMLDivElement>(null);

  // Per-frame state — refs only, never React state.
  const offset = useRef(0);
  const passWidth = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);
  const dragging = useRef(false);
  const momentum = useRef(0);
  const lastX = useRef(0);
  const lastMoveAt = useRef(0);
  const dragDistance = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const track = trackRef.current;
    const pass = passRef.current;
    if (!track || !pass) return;

    const ro = new ResizeObserver(() => {
      passWidth.current = pass.offsetWidth;
    });
    ro.observe(pass);
    passWidth.current = pass.offsetWidth;

    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.064); // clamp tab-switch jumps
      last = now;
      const w = passWidth.current;
      if (w > 0 && !dragging.current) {
        const auto = hovered.current || focused.current ? 0 : SPEED;
        offset.current += (auto + momentum.current) * dt;
        if (momentum.current !== 0) {
          momentum.current *= Math.exp(-FRICTION * dt);
          if (Math.abs(momentum.current) < 4) momentum.current = 0;
        }
      }
      if (w > 0) {
        offset.current = ((offset.current % w) + w) % w;
        track.style.transform = `translate3d(${-offset.current}px,0,0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [reduced]);

  if (reduced) {
    return (
      <>
        <style>{MARQUEE_CSS}</style>
        <div className="team-marquee-static">
          {team.map((member) => (
            <div key={member.name} className="team-marquee-card">
              <TeamCard member={member} />
            </div>
          ))}
        </div>
      </>
    );
  }

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragging.current = true;
    dragDistance.current = 0;
    momentum.current = 0;
    lastX.current = e.clientX;
    lastMoveAt.current = e.timeStamp;
    try {
      viewportRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Capture is an enhancement — drag still tracks via pointermove.
    }
    viewportRef.current?.setAttribute("data-dragging", "true");
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    const dx = e.clientX - lastX.current;
    const dtMs = e.timeStamp - lastMoveAt.current;
    lastX.current = e.clientX;
    lastMoveAt.current = e.timeStamp;
    dragDistance.current += Math.abs(dx);
    offset.current -= dx; // content follows the pointer
    if (dtMs > 0) {
      // Smoothed offset-velocity (px/s) for the release flick.
      const v = (-dx / dtMs) * 1000;
      momentum.current = 0.8 * v + 0.2 * momentum.current;
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging.current) return;
    dragging.current = false;
    viewportRef.current?.setAttribute("data-dragging", "false");
    try {
      viewportRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // Already released (e.g. pointercancel) — fine.
    }
    momentum.current = Math.max(
      -MAX_FLICK,
      Math.min(MAX_FLICK, momentum.current),
    );
    if (dragDistance.current > 6) suppressClick.current = true;
  }

  return (
    <>
      <style>{MARQUEE_CSS}</style>
      <div
        ref={viewportRef}
        className="team-marquee"
        data-dragging="false"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") hovered.current = true;
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === "mouse") hovered.current = false;
        }}
        onFocusCapture={() => {
          focused.current = true;
        }}
        onBlurCapture={(e) => {
          focused.current = e.currentTarget.contains(
            e.relatedTarget as Node | null,
          );
        }}
        onClickCapture={(e) => {
          // A real drag must not activate whatever card it ended on.
          if (suppressClick.current) {
            suppressClick.current = false;
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onDragStart={(e) => e.preventDefault()}
      >
        <div ref={trackRef} className="team-marquee-track">
          {[false, true].map((isCopy) => (
            <div
              key={isCopy ? "copy" : "main"}
              ref={isCopy ? undefined : passRef}
              className="team-marquee-pass"
              aria-hidden={isCopy || undefined}
              inert={isCopy || undefined}
            >
              {team.map((member) => (
                <div key={member.name} className="team-marquee-card">
                  <TeamCard member={member} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
