"use client";

import Image from "next/image";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Quote, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Container,
  DotPattern,
  Eyebrow,
  Reveal,
  Section,
} from "@/components/ui";

const paraStyle: CSSProperties = {
  margin: 0,
  fontSize: "var(--fs-body-lg)",
  lineHeight: 1.72,
  color: "var(--color-text-muted)",
};

/** Gap (px) between the eyebrow/title block and the letter body. */
const BODY_GAP = 28;

type Slide = {
  eyebrow: string;
  title: string;
  paragraphs: string[];
  name: string;
  role: string;
  company: string;
  imageAlt: string;
  signatureAlt?: string;
};

/**
 * Non-localized assets, merged with the localized `slides` by index.
 * (image paths / crop don't belong in the translation files.)
 */
const ASSETS: {
  image: string;
  signature?: string;
  objectPosition: string;
}[] = [
  {
    image: "/top-message.jpg",
    signature: "/signature.png",
    objectPosition: "center 18%",
  },
  // TODO: replace with a higher-res portrait of the Chief Advisor if supplied.
  { image: "/moazzem-testimonial.jpg", objectPosition: "center top" },
];

/**
 * Leadership messages — a letter (left) + portrait & signature (right),
 * presented as a simple manual carousel (prev / dots / next) when more than
 * one message is configured. Each slide keeps the read-more clamp that aligns
 * the letter's bottom with the figure.
 */
export function AboutMessage() {
  const t = useTranslations("about.message");
  const slides = t.raw("slides") as Slide[];
  const reduced = useReducedMotion();

  const [active, setActive] = useState(0);
  const slide = slides[active] ?? slides[0];
  const asset = ASSETS[active] ?? ASSETS[0];
  const multiple = slides.length > 1;

  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);

  const [expanded, setExpanded] = useState(false);
  // Collapsed height aligns the letter's bottom with the figure's (the name
  // plate). Defaults keep it clamped on first paint (no full-text flash); the
  // effect refines to the measured, figure-aligned value (per active slide).
  const [collapsedH, setCollapsedH] = useState(460);
  const [fullH, setFullH] = useState(2400);
  const [clamp, setClamp] = useState(true);

  useEffect(() => {
    const recompute = () => {
      const body = bodyRef.current;
      if (!body) return;
      const full = body.scrollHeight;
      const stacked = window.innerWidth <= 980;
      const fig = figureRef.current;
      const head = headerRef.current;
      // Desktop: align the letter's bottom with the figure (portrait + name
      // plate). Stacked (mobile): a fixed, readable clamp.
      const target =
        stacked || !fig || !head
          ? 360
          : Math.max(200, fig.offsetHeight - head.offsetHeight - BODY_GAP);
      setCollapsedH(target);
      setFullH(full + 8);
      setClamp(full > target + 28);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    if (figureRef.current) ro.observe(figureRef.current);
    if (headerRef.current) ro.observe(headerRef.current);
    window.addEventListener("resize", recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
    };
    // Re-measure when the active slide changes (content + figure differ).
  }, [active, slide.paragraphs.length]);

  const collapsed = clamp && !expanded;
  const showToggle = clamp;

  const goTo = (index: number) => {
    setExpanded(false);
    setActive(((index % slides.length) + slides.length) % slides.length);
  };

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <DotPattern
        color="var(--teal-200)"
        gap={22}
        fade="radial"
        style={{ opacity: 0.4 }}
      />
      <Container style={{ position: "relative" }}>
        <Reveal>
          <div
            role="group"
            aria-roledescription="carousel"
            aria-label={t("regionLabel")}
          >
            {/* Slide — re-keyed so each change animates in. */}
            <motion.div
              key={active}
              initial={reduced ? false : { opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="equal-2col"
              style={{
                display: "grid",
                gridTemplateColumns: "1.15fr 0.85fr",
                gap: "clamp(32px, 5vw, 72px)",
                alignItems: "start",
              }}
            >
              {/* Letter */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div ref={headerRef}>
                  <Eyebrow>{slide.eyebrow}</Eyebrow>
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "flex-start",
                      marginTop: 18,
                    }}
                  >
                    <Quote
                      size={40}
                      strokeWidth={1.4}
                      aria-hidden
                      style={{
                        color: "var(--teal-300)",
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                    <h2
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "clamp(1.45rem, 1.05rem + 1.4vw, 2.15rem)",
                        lineHeight: 1.16,
                        letterSpacing: "-.02em",
                        color: "var(--color-text-strong)",
                        margin: 0,
                        textWrap: "balance" as CSSProperties["textWrap"],
                      }}
                    >
                      {slide.title}
                    </h2>
                  </div>
                </div>

                <div style={{ marginTop: BODY_GAP }}>
                  <div
                    ref={bodyRef}
                    style={{
                      position: "relative",
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                      maxWidth: "64ch",
                      maxHeight: clamp
                        ? collapsed
                          ? collapsedH
                          : fullH
                        : undefined,
                      overflow: clamp ? "hidden" : undefined,
                      transition: reduced
                        ? undefined
                        : "max-height .5s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  >
                    {slide.paragraphs.map((p, pi) => (
                      <p key={pi} style={paraStyle}>
                        {p}
                      </p>
                    ))}
                    {collapsed && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          height: 84,
                          background:
                            "linear-gradient(to bottom, transparent, var(--color-surface-2))",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </div>

                  {showToggle && (
                    <button
                      type="button"
                      onClick={() => setExpanded((v) => !v)}
                      aria-expanded={expanded}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 16,
                        padding: 0,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--color-brand-deep)",
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: "var(--fs-small)",
                      }}
                    >
                      {expanded ? t("readLess") : t("readMore")}
                      <ChevronDown
                        size={16}
                        style={{
                          transition: reduced
                            ? undefined
                            : "transform .25s ease",
                          transform: expanded ? "rotate(180deg)" : "none",
                        }}
                      />
                    </button>
                  )}
                </div>
              </div>

              {/* Portrait + signature / name / title / company */}
              <figure ref={figureRef} style={{ margin: 0 }}>
                <div
                  style={{
                    position: "relative",
                    aspectRatio: "4 / 5",
                    borderRadius: "var(--r-2xl)",
                    overflow: "hidden",
                    boxShadow: "var(--shadow-xl)",
                    border: "1px solid var(--color-hairline)",
                    background: "var(--color-surface)",
                  }}
                >
                  <Image
                    src={asset.image}
                    alt={slide.imageAlt}
                    fill
                    sizes="(max-width: 980px) 100vw, 34vw"
                    style={{
                      objectFit: "cover",
                      objectPosition: asset.objectPosition,
                    }}
                  />
                </div>

                <figcaption style={{ marginTop: 22 }}>
                  {asset.signature && slide.signatureAlt && (
                    <div
                      style={{ position: "relative", width: 176, height: 58 }}
                    >
                      <Image
                        src={asset.signature}
                        alt={slide.signatureAlt}
                        fill
                        sizes="176px"
                        style={{
                          objectFit: "contain",
                          objectPosition: "left center",
                        }}
                      />
                    </div>
                  )}
                  <div
                    style={{
                      fontFamily: "var(--font-display)",
                      fontWeight: 600,
                      fontSize: 17,
                      color: "var(--color-text-strong)",
                      marginTop: asset.signature ? 14 : 0,
                    }}
                  >
                    {slide.name}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--color-text-muted)",
                      marginTop: 3,
                    }}
                  >
                    {slide.role}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      letterSpacing: ".08em",
                      textTransform: "uppercase",
                      color: "var(--color-brand-deep)",
                      marginTop: 6,
                    }}
                  >
                    {slide.company}
                  </div>
                </figcaption>
              </figure>
            </motion.div>

            {/* Carousel controls */}
            {multiple && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  marginTop: 44,
                }}
              >
                <NavButton label={t("prev")} onClick={() => goTo(active - 1)}>
                  <ChevronLeft size={20} aria-hidden />
                </NavButton>

                <div
                  role="tablist"
                  aria-label={t("regionLabel")}
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  {slides.map((s, i) => {
                    const isActive = i === active;
                    return (
                      <button
                        key={s.name}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        aria-label={t("slideLabel", { n: i + 1 })}
                        onClick={() => goTo(i)}
                        style={{
                          height: 8,
                          width: isActive ? 26 : 8,
                          padding: 0,
                          borderRadius: 999,
                          border: "none",
                          cursor: "pointer",
                          background: isActive
                            ? "var(--brand-teal)"
                            : "var(--teal-200)",
                          transition: reduced
                            ? undefined
                            : "width .3s cubic-bezier(0.16,1,0.3,1), background .2s",
                        }}
                      />
                    );
                  })}
                </div>

                <NavButton label={t("next")} onClick={() => goTo(active + 1)}>
                  <ChevronRight size={20} aria-hidden />
                </NavButton>
              </div>
            )}
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        width: 46,
        height: 46,
        flexShrink: 0,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--color-hairline)",
        background: "var(--color-surface)",
        color: "var(--color-brand-deep)",
        cursor: "pointer",
        transition:
          "background 180ms, border-color 180ms, transform 200ms cubic-bezier(.16,1,.3,1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--brand-teal)";
        e.currentTarget.style.borderColor = "var(--brand-teal)";
        e.currentTarget.style.color = "white";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "var(--color-surface)";
        e.currentTarget.style.borderColor = "var(--color-hairline)";
        e.currentTarget.style.color = "var(--color-brand-deep)";
        e.currentTarget.style.transform = "translateY(0)";
      }}
    >
      {children}
    </button>
  );
}
