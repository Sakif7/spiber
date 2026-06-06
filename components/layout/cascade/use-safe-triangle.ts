"use client";

import { useRef } from "react";

export type Pt = { x: number; y: number; t: number };

/**
 * "Safe triangle" / menu-aim test for a FLUSH cascade (the child column's left
 * edge sits exactly on the parent column's right edge). Because there's no gap,
 * the classic triangle reduces to: is the pointer moving rightward AND will its
 * straight-line trajectory cross the open child column's left edge within the
 * column's vertical span (plus a little slack)? If so, the user is aiming at the
 * sub-panel — keep it open and ignore hovers over sibling rows along the way.
 *
 * `rect` is the bounding box of the DEEPEST currently-open column, read FRESH on
 * every move (never cached — it shifts on scroll / layout).
 */
export function isAimingAtSubmenu(
  prev: Pt,
  cur: Pt,
  rect: DOMRect | null,
): boolean {
  if (!rect) return false;
  const vx = cur.x - prev.x;
  if (vx <= 0) return false; // not heading toward the right-side panel → reject fast
  if (cur.x >= rect.left) return true; // already over/at the panel → keep open
  const s = (rect.left - cur.x) / vx; // vx > 0 guaranteed → no divide-by-zero
  const yHit = cur.y + s * (cur.y - prev.y); // where the ray crosses x = rect.left
  return yHit >= rect.top - SLACK && yHit <= rect.bottom + SLACK;
}

const SLACK = 12; // px of vertical forgiveness at the seam
const GRACE_MS = 200; // how long an "aiming" verdict keeps protecting the path

/**
 * Tracks the pointer and exposes:
 *  - `onPointerMove`   — wire to the cascade region (passive, no re-render)
 *  - `isAiming()`      — true while the cursor is mid-flight toward the open sub-panel
 *  - `setChildCol(el)` — point at the DEEPEST open column's element each render
 */
export function useSafeTriangle() {
  const last = useRef<Pt | null>(null);
  const aimUntil = useRef(0);
  const childCol = useRef<HTMLElement | null>(null);

  const onPointerMove = (e: { clientX: number; clientY: number }) => {
    const cur: Pt = { x: e.clientX, y: e.clientY, t: performance.now() };
    const prev = last.current;
    if (prev && childCol.current) {
      const rect = childCol.current.getBoundingClientRect();
      if (isAimingAtSubmenu(prev, cur, rect))
        aimUntil.current = cur.t + GRACE_MS;
    }
    last.current = cur;
  };

  const isAiming = () => performance.now() < aimUntil.current;
  const setChildCol = (el: HTMLElement | null) => {
    childCol.current = el;
  };

  return { onPointerMove, isAiming, setChildCol };
}
