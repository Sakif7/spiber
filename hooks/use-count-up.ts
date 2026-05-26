"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useCountUp — animate from 0 to `target` when the ref enters the viewport.
 *
 * Returns a tuple of [ref, formattedValue]. Attach the ref to the element
 * whose visibility should kick off the count; render the formatted value
 * inline. Has a 400 ms fallback in case IntersectionObserver never fires
 * (some iframe/preview environments) so the counter never gets stuck at 0.
 */
export function useCountUp(
  target: number,
  duration = 1400,
  decimals = 0
): [React.RefObject<HTMLDivElement | null>, string] {
  const ref = useRef<HTMLDivElement>(null);
  const [val, setVal] = useState(0);
  const startedRef = useRef(false);

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) requestAnimationFrame(step);
      else setVal(target);
    };
    requestAnimationFrame(step);
  }, [target, duration]);

  useEffect(() => {
    if (!ref.current) return;
    const fallback = setTimeout(start, 400);
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            start();
            obs.disconnect();
          }
        });
      },
      { threshold: 0.4 }
    );
    obs.observe(ref.current);
    return () => {
      obs.disconnect();
      clearTimeout(fallback);
    };
  }, [start]);

  const formatted =
    decimals > 0 ? val.toFixed(decimals) : Math.round(val).toLocaleString("en-US");
  return [ref, formatted];
}
