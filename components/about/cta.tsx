"use client";

import { CSSProperties, useRef } from "react";
import { useTranslations } from "next-intl";
import { HeartHandshake } from "lucide-react";
import {
  motion,
  useScroll,
  useTransform,
  useReducedMotion,
} from "framer-motion";
import { Arrow, Container, DotPattern } from "@/components/ui";
import { Link } from "@/i18n/navigation";

const outlineBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 24px",
  borderRadius: "var(--r-pill)",
  fontSize: 15,
  fontWeight: 500,
  color: "#fff",
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.45)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

const orangeBtn: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "14px 24px",
  borderRadius: "var(--r-pill)",
  fontSize: 15,
  fontWeight: 600,
  color: "#fff",
  background: "var(--color-secondary)",
  border: "1px solid transparent",
  boxShadow:
    "0 10px 24px -10px color-mix(in srgb, var(--brand-orange) 70%, transparent)",
  textDecoration: "none",
  whiteSpace: "nowrap",
};

/**
 * Closing CTA — a deep-teal card that scroll-expands: it starts inset and
 * rounded, then scales up to fill the section edge-to-edge as it reaches the
 * viewport centre. Transform/opacity only; static (filled) under reduced-motion.
 */
export function AboutCta() {
  const t = useTranslations("about.cta");
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "center center"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [0.8, 1]);
  const radius = useTransform(scrollYProgress, [0, 1], [44, 0]);

  return (
    <section
      ref={ref}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        /* No vertical padding: at full scroll the card fills the section on
           every edge (top/bottom too). The inset frame while scrolling comes
           from the scale transform itself. */
        paddingBlock: 0,
        overflow: "hidden",
      }}
    >
      <motion.div
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          color: "#fff",
          background:
            "linear-gradient(120deg, var(--teal-800), var(--teal-900))",
          boxShadow: "var(--shadow-xl)",
          transformOrigin: "center",
          willChange: "transform",
          scale: reduced ? 1 : scale,
          borderRadius: reduced ? 0 : radius,
        }}
      >
        <DotPattern
          color="var(--teal-300)"
          gap={20}
          fade="radial"
          style={{
            inset: "auto",
            top: -90,
            right: -70,
            width: 480,
            height: 480,
            opacity: 0.18,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -120,
            left: -80,
            width: 360,
            height: 360,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, color-mix(in oklab, var(--aqua-400) 22%, transparent), transparent 70%)",
          }}
        />

        <Container style={{ paddingBlock: "clamp(40px, 6vw, 76px)" }}>
          <div
            className="about-cta-card"
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: "clamp(20px, 3vw, 40px)",
              alignItems: "center",
            }}
          >
            <span
              style={{
                display: "grid",
                placeItems: "center",
                width: 72,
                height: 72,
                borderRadius: "var(--r-pill)",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                color: "var(--aqua-300)",
                flexShrink: 0,
              }}
            >
              <HeartHandshake size={34} strokeWidth={1.5} aria-hidden />
            </span>

            <div>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "clamp(1.6rem, 1.1rem + 1.6vw, 2.4rem)",
                  lineHeight: 1.1,
                  letterSpacing: "-.02em",
                  margin: "0 0 10px",
                  color: "#fff",
                  maxWidth: "20ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                }}
              >
                {t("title")}
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-body-lg)",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,0.72)",
                  maxWidth: "54ch",
                }}
              >
                {t("description")}
              </p>
            </div>

            <div
              style={{
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
                flexShrink: 0,
                justifyContent: "center",
              }}
            >
              <Link href="/contact" style={outlineBtn}>
                {t("contact")}
              </Link>
              <Link href="/medtrade" style={orangeBtn}>
                {t("quote")} <Arrow size={16} />
              </Link>
            </div>
          </div>
        </Container>
      </motion.div>
    </section>
  );
}
