"use client";

import { useId } from "react";

/**
 * Dependency-free dual-thumb range slider (price filters). Two NATIVE range
 * inputs overlaid on one track — both thumbs stay keyboard-accessible and
 * screen-reader labelled. The lower thumb is clamped to the upper and vice
 * versa. `onChange` fires on every move (update the linked number inputs);
 * `onCommit` fires on release / keyup — the moment to apply the filter.
 */
export function DualRange({
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  onCommit,
  ariaLabelMin,
  ariaLabelMax,
}: {
  min: number;
  max: number;
  step?: number;
  valueMin: number;
  valueMax: number;
  onChange: (lo: number, hi: number) => void;
  onCommit: (lo: number, hi: number) => void;
  ariaLabelMin: string;
  ariaLabelMax: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9-]/g, "");
  const cls = `dr-${uid}`;
  const span = Math.max(1, max - min);
  const lo = Math.min(Math.max(valueMin, min), max);
  const hi = Math.max(Math.min(valueMax, max), min);
  const loPct = ((lo - min) / span) * 100;
  const hiPct = ((hi - min) / span) * 100;

  const commit = () => onCommit(lo, hi);

  return (
    <div
      className={cls}
      style={{ position: "relative", height: 28, marginTop: 2 }}
    >
      <style>{`
        .${cls} input[type="range"] {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 28px;
          margin: 0;
          appearance: none;
          -webkit-appearance: none;
          background: none;
          /* The track ignores the pointer; only the thumbs take it, so the two
             overlaid inputs never fight over a click. */
          pointer-events: none;
        }
        .${cls} input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--color-surface);
          border: 2px solid var(--color-brand);
          box-shadow: 0 1px 4px rgba(10, 31, 44, 0.25);
          cursor: grab;
        }
        .${cls} input[type="range"]::-moz-range-thumb {
          pointer-events: auto;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: var(--color-surface);
          border: 2px solid var(--color-brand);
          box-shadow: 0 1px 4px rgba(10, 31, 44, 0.25);
          cursor: grab;
        }
        .${cls} input[type="range"]:focus-visible::-webkit-slider-thumb {
          outline: 2px solid var(--color-brand);
          outline-offset: 2px;
        }
        .${cls} input[type="range"]:focus-visible::-moz-range-thumb {
          outline: 2px solid var(--color-brand);
          outline-offset: 2px;
        }
      `}</style>

      {/* Track + active fill */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          right: 0,
          height: 4,
          transform: "translateY(-50%)",
          borderRadius: 999,
          background: "var(--color-border)",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "50%",
          left: `${loPct}%`,
          width: `${Math.max(0, hiPct - loPct)}%`,
          height: 4,
          transform: "translateY(-50%)",
          borderRadius: 999,
          background: "var(--color-brand)",
        }}
      />

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={lo}
        aria-label={ariaLabelMin}
        onChange={(e) => {
          const v = Math.min(Number(e.target.value), hi);
          onChange(v, hi);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={hi}
        aria-label={ariaLabelMax}
        onChange={(e) => {
          const v = Math.max(Number(e.target.value), lo);
          onChange(lo, v);
        }}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
      />
    </div>
  );
}
