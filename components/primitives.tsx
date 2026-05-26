"use client";

import {
  CSSProperties,
  ElementType,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/* ============================================================
   Reveal — fade-up on scroll into view
   Uses framer-motion's useInView so children animate when they
   enter the viewport. Falls back gracefully under prefers-reduced.
   ============================================================ */
type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
  once?: boolean;
};
export function Reveal({
  children,
  delay = 0,
  y = 24,
  as,
  style,
  className,
  once = true,
}: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: "0px 0px -8% 0px", amount: 0.15 });
  const reduced = useReducedMotion();
  const MotionTag = motion[(as as keyof typeof motion) ?? "div"] as typeof motion.div;

  return (
    <MotionTag
      ref={ref as React.RefObject<HTMLDivElement>}
      initial={reduced ? false : { opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{
        duration: 0.7,
        delay: delay / 1000,
        ease: [0.16, 1, 0.3, 1],
      }}
      style={style}
      className={className}
    >
      {children}
    </MotionTag>
  );
}

/* ============================================================
   useMagnetic — cursor-tracked translate within an envelope
   ============================================================ */
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

/* ============================================================
   useCountUp — animate 0 → target when visible
   ============================================================ */
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

/* ============================================================
   Placeholder — striped SVG with mono label
   ============================================================ */
type Tone = "teal" | "orange" | "slate" | "dark";
export function Placeholder({
  label,
  tone = "teal",
  style,
  className,
  children,
}: {
  label: string;
  tone?: Tone;
  style?: CSSProperties;
  className?: string;
  children?: ReactNode;
}) {
  // React's useId() is stable across SSR + client, preventing hydration
  // mismatch. We strip the colons that appear in some React versions so the
  // string is valid inside an SVG fragment-identifier url(#…) reference.
  const rawId = useId();
  const id = "ph" + rawId.replace(/[^a-z0-9]/gi, "");
  const bg =
    tone === "teal"
      ? "linear-gradient(135deg, var(--teal-50), var(--teal-100))"
      : tone === "orange"
      ? "linear-gradient(135deg, var(--orange-50), var(--orange-100))"
      : tone === "slate"
      ? "linear-gradient(135deg, var(--slate-100), var(--slate-200))"
      : tone === "dark"
      ? "linear-gradient(135deg, var(--slate-800), var(--slate-900))"
      : "var(--color-surface-2)";
  const stroke =
    tone === "teal"
      ? "rgba(14,139,134,.18)"
      : tone === "orange"
      ? "rgba(230,107,38,.18)"
      : tone === "slate"
      ? "rgba(10,19,24,.08)"
      : tone === "dark"
      ? "rgba(255,255,255,.08)"
      : "rgba(10,19,24,.08)";
  const txt =
    tone === "dark"
      ? "rgba(255,255,255,.85)"
      : tone === "orange"
      ? "var(--orange-700)"
      : tone === "teal"
      ? "var(--teal-700)"
      : "var(--slate-700)";

  return (
    <div
      className={className}
      style={{ position: "relative", overflow: "hidden", background: bg, ...style }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern
            id={id}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="10" stroke={stroke} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} />
      </svg>
      {label && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: txt,
              background: tone === "dark" ? "rgba(10,19,24,.6)" : "rgba(255,255,255,.78)",
              padding: "5px 9px",
              borderRadius: 4,
              backdropFilter: "blur(4px)",
            }}
          >
            ↓ {label}
          </span>
        </div>
      )}
      {children}
    </div>
  );
}

/* ============================================================
   Container — max-width content wrapper
   ============================================================ */
export function Container({
  children,
  style,
  narrow,
  className,
}: {
  children: ReactNode;
  style?: CSSProperties;
  narrow?: boolean;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        width: "100%",
        maxWidth: narrow ? 980 : "var(--container-max)",
        marginInline: "auto",
        paddingInline: "var(--container-pad)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Section — vertical rhythm wrapper
   ============================================================ */
export function Section({
  children,
  dark,
  mesh,
  id,
  style,
  py = "clamp(72px, 8vw, 128px)",
}: {
  children: ReactNode;
  dark?: boolean;
  mesh?: boolean;
  id?: string;
  style?: CSSProperties;
  py?: string;
}) {
  return (
    <section
      id={id}
      style={{
        position: "relative",
        paddingBlock: py,
        background: dark ? "var(--color-surface-inv)" : "transparent",
        color: dark ? "var(--color-text-inv)" : "var(--color-text)",
        overflow: "hidden",
        ...style,
      }}
    >
      {mesh && (
        <div
          className="mesh"
          style={{ position: "absolute", inset: 0, opacity: dark ? 0.35 : 0.18 }}
        />
      )}
      <div style={{ position: "relative" }}>{children}</div>
    </section>
  );
}

/* ============================================================
   Eyebrow — small uppercase label above section titles
   ============================================================ */
export function Eyebrow({
  children,
  dark,
  style,
}: {
  children: ReactNode;
  dark?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: ".18em",
        textTransform: "uppercase",
        color: dark ? "var(--teal-300)" : "var(--color-brand-deep)",
        ...style,
      }}
    >
      <span style={{ width: 18, height: 1, background: "currentColor", opacity: 0.7 }} />
      {children}
    </div>
  );
}

/* ============================================================
   SectionTitle — eyebrow + heading + lede
   ============================================================ */
export function SectionTitle({
  eyebrow,
  title,
  lede,
  dark,
  align = "left",
  maxTitle = "20ch",
  maxLede = "60ch",
  id,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  dark?: boolean;
  align?: "left" | "center";
  maxTitle?: string;
  maxLede?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 16,
        textAlign: align,
        alignItems: align === "center" ? "center" : "flex-start",
      }}
    >
      {eyebrow && (
        <Reveal delay={0}>
          <Eyebrow dark={dark}>{eyebrow}</Eyebrow>
        </Reveal>
      )}
      <Reveal delay={80}>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "var(--fs-h2)",
            lineHeight: 1.08,
            letterSpacing: "-.02em",
            margin: 0,
            maxWidth: maxTitle,
            textWrap: "balance" as CSSProperties["textWrap"],
            color: dark ? "var(--color-text-inv)" : "var(--color-text-strong)",
          }}
        >
          {title}
        </h2>
      </Reveal>
      {lede && (
        <Reveal delay={160}>
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-body-lg)",
              lineHeight: 1.55,
              maxWidth: maxLede,
              color: dark ? "rgba(255,255,255,.72)" : "var(--color-text-muted)",
            }}
          >
            {lede}
          </p>
        </Reveal>
      )}
    </div>
  );
}

/* ============================================================
   Arrow icon
   ============================================================ */
export function Arrow({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      style={{ flexShrink: 0 }}
      aria-hidden="true"
    >
      <path
        d="M3 7h8M7 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
