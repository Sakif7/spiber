"use client";

import Image from "next/image";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useReducedMotion } from "framer-motion";
import { Quote, ChevronDown } from "lucide-react";
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

/** "Message from the MD" — letter (left) + portrait & signature (right). */
export function AboutMessage() {
  const t = useTranslations("about.message");
  const paragraphs = t.raw("paragraphs") as string[];
  const reduced = useReducedMotion();

  const colRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);

  const [expanded, setExpanded] = useState(false);
  // Collapsed height aligns the letter's bottom with the figure's (the name
  // plate). Defaults keep it clamped on first paint (no full-text flash); the
  // effect refines to the measured, figure-aligned value.
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
  }, [paragraphs.length]);

  const collapsed = clamp && !expanded;
  const showToggle = clamp;

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <DotPattern
        color="var(--teal-200)"
        gap={22}
        fade="radial"
        style={{ opacity: 0.4 }}
      />
      <Container style={{ position: "relative" }}>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: "clamp(32px, 5vw, 72px)",
            alignItems: "start",
          }}
        >
          {/* Letter */}
          <div
            ref={colRef}
            style={{ display: "flex", flexDirection: "column" }}
          >
            <div ref={headerRef}>
              <Reveal>
                <Eyebrow>{t("eyebrow")}</Eyebrow>
              </Reveal>
              <Reveal delay={80}>
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
                    {t("title")}
                  </h2>
                </div>
              </Reveal>
            </div>

            <Reveal delay={140} style={{ marginTop: BODY_GAP }}>
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
                {paragraphs.map((p) => (
                  <p key={p.slice(0, 24)} style={paraStyle}>
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
                      transition: reduced ? undefined : "transform .25s ease",
                      transform: expanded ? "rotate(180deg)" : "none",
                    }}
                  />
                </button>
              )}
            </Reveal>
          </div>

          {/* Portrait (→ video) + signature / name / title / company */}
          <Reveal delay={120}>
            <figure ref={figureRef} style={{ margin: 0 }}>
              {/*
                TODO: this frame will hold a <video> message from the MD once
                the asset is supplied. For now it shows /top-message.jpg —
                swap <Image> for <video controls poster=…> when ready.
              */}
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
                  src="/top-message.jpg"
                  alt={t("imageAlt")}
                  fill
                  sizes="(max-width: 980px) 100vw, 34vw"
                  style={{ objectFit: "cover", objectPosition: "center 18%" }}
                />
              </div>

              <figcaption style={{ marginTop: 22 }}>
                {/* TODO: real client asset — /signature.png. */}
                <div style={{ position: "relative", width: 176, height: 58 }}>
                  <Image
                    src="/signature.png"
                    alt={t("signatureAlt")}
                    fill
                    sizes="176px"
                    style={{
                      objectFit: "contain",
                      objectPosition: "left center",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 17,
                    color: "var(--color-text-strong)",
                    marginTop: 14,
                  }}
                >
                  {t("name")}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    color: "var(--color-text-muted)",
                    marginTop: 3,
                  }}
                >
                  {t("role")}
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
                  {t("company")}
                </div>
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
