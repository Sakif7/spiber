"use client";

import Image from "next/image";
import { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  Container,
  Eyebrow,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";

type CompassItem = { key: string; title: string; body: string };
type Transformation = { title: string; body: string };

/** Intro narrative (left) + a stock photo with the vision pull-quote (right). */
export function VisionIntro() {
  const t = useTranslations("vision2040.intro");
  const paragraphs = t.raw("paragraphs") as string[];
  return (
    <Section style={{ background: "var(--color-surface)" }}>
      <Container>
        <div
          className="vision-intro-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 0.8fr",
            gap: "clamp(32px, 5vw, 72px)",
            alignItems: "start",
          }}
        >
          <div>
            <Reveal>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
            </Reveal>
            <Reveal delay={90}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "var(--fs-h2)",
                  lineHeight: 1.08,
                  letterSpacing: "-.02em",
                  color: "var(--color-text-strong)",
                  margin: "18px 0 24px",
                  maxWidth: "18ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                }}
              >
                {t("title")}
              </h2>
            </Reveal>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {paragraphs.map((p, i) => (
                <Reveal key={i} delay={150 + i * 60}>
                  <p
                    style={{
                      margin: 0,
                      fontSize: "var(--fs-body-lg)",
                      lineHeight: 1.75,
                      color: "var(--color-text-muted)",
                      maxWidth: "64ch",
                    }}
                  >
                    {p}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={120}>
            <figure
              style={{
                position: "relative",
                margin: 0,
                aspectRatio: "3 / 4",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--color-hairline)",
              }}
            >
              <Image
                src="/radiology-technician-by-ct-scanner.jpeg"
                alt={t("pullquote")}
                fill
                sizes="(max-width: 900px) 100vw, 36vw"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(7,23,33,0.05) 30%, rgba(6,37,39,0.85))",
                }}
              />
              <figcaption
                style={{
                  position: "absolute",
                  inset: "auto 0 0 0",
                  padding: "clamp(20px, 3vw, 30px)",
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "clamp(1.3rem, 1rem + 1vw, 1.8rem)",
                  lineHeight: 1.15,
                  letterSpacing: "-.02em",
                  color: "#fff",
                }}
              >
                {t("pullquote")}
              </figcaption>
            </figure>
          </Reveal>
        </div>
      </Container>
      <style>{`
        @media (max-width: 900px) {
          .vision-intro-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Section>
  );
}

/** Value Creation Compass — intro + five numbered model cards (no icons). */
export function VisionCompass() {
  const t = useTranslations("vision2040.compass");
  const items = t.raw("items") as CompassItem[];
  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <SectionTitle
          eyebrow={t("eyebrow")}
          title={t("title")}
          lede={t("body")}
          maxLede="70ch"
        />
        <div
          style={{
            marginTop: "clamp(32px, 4vw, 52px)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
          }}
        >
          {items.map((it, i) => (
            <Reveal key={it.key} delay={(i % 3) * 90}>
              <NumberedCard index={i + 1} title={it.title} body={it.body} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** Four Transformations — intro + four numbered editorial cards (no icons). */
export function VisionTransformations() {
  const t = useTranslations("vision2040.transformations");
  const items = t.raw("items") as Transformation[];
  return (
    <Section style={{ background: "var(--color-surface)" }}>
      <Container>
        <SectionTitle
          eyebrow={t("eyebrow")}
          title={t("title")}
          lede={t("body")}
          maxLede="64ch"
        />
        <div
          className="equal-4col"
          style={{
            marginTop: "clamp(32px, 4vw, 52px)",
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 90}>
              <NumberedCard index={i + 1} title={it.title} body={it.body} />
            </Reveal>
          ))}
        </div>
      </Container>
      <style>{`
        @media (max-width: 980px) { .equal-4col { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 560px) { .equal-4col { grid-template-columns: 1fr !important; } }
      `}</style>
    </Section>
  );
}

/** Shared numbered editorial card: big faint numeral + title + body, hover lift. */
function NumberedCard({
  index,
  title,
  body,
}: {
  index: number;
  title: string;
  body: string;
}) {
  return (
    <article
      className="numbered-card"
      style={{
        position: "relative",
        height: "100%",
        overflow: "hidden",
        padding: "28px 24px 28px",
        borderRadius: "var(--r-xl)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-hairline)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      <span
        aria-hidden
        className="numbered-bar"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background:
            "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
          transformOrigin: "left",
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 6,
          right: 16,
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 64,
          lineHeight: 1,
          color: "var(--color-brand)",
          opacity: 0.08,
          letterSpacing: "-.04em",
        }}
      >
        {String(index).padStart(2, "0")}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          letterSpacing: ".16em",
          color: "var(--color-brand-deep)",
        }}
      >
        {String(index).padStart(2, "0")}
      </span>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 17,
          lineHeight: 1.3,
          letterSpacing: "-.01em",
          color: "var(--color-text-strong)",
          margin: "10px 0 10px",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--color-text-muted)",
        }}
      >
        {body}
      </p>
      <style>{`
        .numbered-card { transition: transform 320ms cubic-bezier(.16,1,.3,1), box-shadow 320ms cubic-bezier(.16,1,.3,1), border-color 320ms; }
        .numbered-card .numbered-bar { transform: scaleX(0); transition: transform 420ms cubic-bezier(.16,1,.3,1); }
        .numbered-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--teal-300); }
        .numbered-card:hover .numbered-bar { transform: scaleX(1); }
        @media (prefers-reduced-motion: reduce) {
          .numbered-card, .numbered-card .numbered-bar { transition: none; }
          .numbered-card:hover { transform: none; }
        }
      `}</style>
    </article>
  );
}
