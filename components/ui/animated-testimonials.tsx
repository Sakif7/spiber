"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

export type AnimatedTestimonial = {
  quote: string;
  name: string;
  designation: string;
  src: string;
};

const QUOTE_LINE_CLAMP = 7;
// Deterministic tilt sequence — random() during render breaks SSR hydration.
const ROT_SEQUENCE = [-7, 6, -4, 9, -8, 5, -3, 7];

export function AnimatedTestimonials({
  testimonials,
  autoplay = true,
  intervalMs = 7000,
}: {
  testimonials: AnimatedTestimonial[];
  autoplay?: boolean;
  intervalMs?: number;
}) {
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const rotations = useMemo(
    () => testimonials.map((_, i) => ROT_SEQUENCE[i % ROT_SEQUENCE.length]),
    [testimonials]
  );

  const handleNext = () => setActive((p) => (p + 1) % testimonials.length);
  const handlePrev = () =>
    setActive((p) => (p - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    if (!autoplay || expanded) return;
    const id = setInterval(
      () => setActive((p) => (p + 1) % testimonials.length),
      intervalMs
    );
    return () => clearInterval(id);
  }, [autoplay, intervalMs, testimonials.length, expanded]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [expanded]);

  const current = testimonials[active];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.85fr) minmax(0, 1fr)",
        gap: 64,
        alignItems: "start",
      }}
      className="anim-testi"
    >
      <div style={{ position: "relative", aspectRatio: "1 / 1", maxWidth: 440 }}>
        <AnimatePresence>
          {testimonials.map((t, i) => {
            const isActive = i === active;
            return (
              <motion.div
                key={t.src + i}
                initial={{ opacity: 0, scale: 0.92, rotate: rotations[i] }}
                animate={{
                  opacity: isActive ? 1 : 0.65,
                  scale: isActive ? 1 : 0.94,
                  rotate: isActive ? 0 : rotations[i],
                  zIndex: isActive ? 40 : testimonials.length - i,
                  y: isActive ? [0, -28, 0] : 0,
                }}
                exit={{ opacity: 0, scale: 0.9, rotate: rotations[i] }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  inset: 0,
                  transformOrigin: "bottom",
                  borderRadius: 24,
                  overflow: "hidden",
                  background: "var(--color-surface-2)",
                  boxShadow:
                    "0 1px 2px rgba(10,31,44,.05), 0 28px 70px -24px rgba(10,31,44,.28), 0 0 0 1px rgba(10,31,44,.04)",
                }}
              >
                <Image
                  src={t.src}
                  alt={t.name}
                  fill
                  sizes="(max-width: 980px) 88vw, 440px"
                  draggable={false}
                  style={{ objectFit: "cover", objectPosition: "center top" }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div
        className="anim-testi-text"
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          minHeight: 440,
        }}
      >
        <motion.div
          key={active}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
              color: "var(--brand-teal)",
              marginBottom: 14,
            }}
          >
            0{active + 1} / 0{testimonials.length} · CLIENT VOICE
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(22px, 2.1vw, 28px)",
              fontWeight: 600,
              letterSpacing: "-.012em",
              color: "var(--color-text-strong)",
              lineHeight: 1.2,
            }}
          >
            {current.name}
          </h3>
          <div
            style={{
              fontSize: 14,
              color: "var(--color-text-muted)",
              marginTop: 6,
            }}
          >
            {current.designation}
          </div>

          <p
            style={{
              margin: "26px 0 0",
              fontFamily: "var(--font-display)",
              fontWeight: 400,
              fontSize: "clamp(17px, 1.45vw, 20px)",
              lineHeight: 1.55,
              letterSpacing: "-.004em",
              color: "var(--color-text)",
              display: "-webkit-box",
              WebkitLineClamp: QUOTE_LINE_CLAMP,
              WebkitBoxOrient: "vertical" as CSSProperties["WebkitBoxOrient"],
              overflow: "hidden",
            }}
          >
            {current.quote.split(" ").map((word, i) => (
              <motion.span
                key={`${active}-${i}`}
                initial={{ filter: "blur(8px)", opacity: 0, y: 4 }}
                animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                transition={{
                  duration: 0.28,
                  ease: [0.16, 1, 0.3, 1],
                  delay: 0.015 * i,
                }}
                style={{ display: "inline-block" }}
              >
                {word}&nbsp;
              </motion.span>
            ))}
          </p>

          <motion.button
            type="button"
            onClick={() => setExpanded(true)}
            whileHover={{ x: 4 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            style={{
              marginTop: 18,
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--brand-teal)",
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 500,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Read full testimonial
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M12 5l7 7-7 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        </motion.div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 24 }}>
          <NavBtn label="Previous testimonial" onClick={handlePrev} direction="left" />
          <NavBtn label="Next testimonial" onClick={handleNext} direction="right" />

          <div style={{ display: "flex", gap: 6, marginLeft: 14 }}>
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                aria-label={`Show testimonial ${i + 1}`}
                style={{
                  width: i === active ? 22 : 6,
                  height: 6,
                  borderRadius: 999,
                  background: i === active ? "var(--color-brand)" : "var(--color-border)",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  transition: "all .35s cubic-bezier(.16,1,.3,1)",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <TestimonialModal
            testimonial={current}
            onClose={() => setExpanded(false)}
          />
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 980px) {
          .anim-testi { grid-template-columns: 1fr !important; gap: 36px !important; }
          .anim-testi > div:first-child { max-width: 100% !important; }
          .anim-testi-text { min-height: 520px !important; }
        }
        @media (max-width: 600px) {
          .anim-testi-text { min-height: 580px !important; }
        }
      `}</style>
    </div>
  );
}

function TestimonialModal({
  testimonial,
  onClose,
}: {
  testimonial: AnimatedTestimonial;
  onClose: () => void;
}) {
  return (
    <motion.div
      key="overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10,31,44,.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Full testimonial from ${testimonial.name}`}
    >
      <motion.div
        key="modal"
        initial={{ y: 28, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 28, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(720px, 100%)",
          maxHeight: "min(82vh, 760px)",
          overflowY: "auto",
          background: "var(--color-surface)",
          borderRadius: 24,
          padding: "44px 52px 40px",
          boxShadow:
            "0 60px 120px -28px rgba(10,31,44,.5), 0 0 0 1px var(--color-border)",
        }}
        className="testi-modal-card"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            width: 36,
            height: 36,
            borderRadius: 999,
            background: "var(--color-surface-2)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-strong)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all .2s cubic-bezier(.16,1,.3,1)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 26,
            paddingBottom: 22,
            borderBottom: "1px solid var(--color-hairline)",
          }}
        >
          <div
            style={{
              position: "relative",
              width: 60,
              height: 60,
              borderRadius: 999,
              overflow: "hidden",
              flexShrink: 0,
              background: "var(--color-surface-2)",
              border: "1px solid var(--color-border)",
            }}
          >
            <Image
              src={testimonial.src}
              alt={testimonial.name}
              fill
              sizes="60px"
              style={{ objectFit: "cover", objectPosition: "center top" }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "-.01em",
                color: "var(--color-text-strong)",
                lineHeight: 1.2,
              }}
            >
              {testimonial.name}
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--color-text-muted)",
                marginTop: 4,
              }}
            >
              {testimonial.designation}
            </div>
          </div>
        </div>

        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 24,
            left: 28,
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontSize: 80,
            lineHeight: 0.8,
            color: "var(--brand-teal)",
            opacity: 0.18,
            pointerEvents: "none",
          }}
        >
          &ldquo;
        </span>

        <p
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 400,
            fontSize: 17,
            lineHeight: 1.65,
            letterSpacing: "-.003em",
            color: "var(--color-text)",
            whiteSpace: "pre-wrap",
          }}
        >
          {testimonial.quote}
        </p>
      </motion.div>

      <style>{`
        @media (max-width: 600px) {
          .testi-modal-card { padding: 36px 24px 28px !important; }
        }
      `}</style>
    </motion.div>
  );
}

function NavBtn({
  onClick,
  direction,
  label,
}: {
  onClick: () => void;
  direction: "left" | "right";
  label: string;
}) {
  const baseStyle: CSSProperties = {
    width: 42,
    height: 42,
    borderRadius: 999,
    background: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-strong)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all .25s cubic-bezier(.16,1,.3,1)",
  };
  return (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      aria-label={label}
      className="anim-testi-btn"
      style={baseStyle}
    >
      <motion.span
        whileHover={{ rotate: direction === "left" ? 12 : -12 }}
        transition={{ type: "spring", stiffness: 380, damping: 22 }}
        style={{ display: "inline-flex" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          {direction === "left" ? (
            <path
              d="M19 12H5M12 19l-7-7 7-7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M5 12h14M12 5l7 7-7 7"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </motion.span>
    </motion.button>
  );
}
