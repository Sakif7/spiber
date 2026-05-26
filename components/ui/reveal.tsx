"use client";

import { CSSProperties, ElementType, ReactNode, useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";

/**
 * Reveal — fade-up on scroll into view.
 *
 * Uses framer-motion's `useInView` so children animate when they enter the
 * viewport. Gracefully no-ops when `prefers-reduced-motion: reduce`.
 */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  as,
  style,
  className,
  once = true,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  as?: ElementType;
  style?: CSSProperties;
  className?: string;
  once?: boolean;
}) {
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
