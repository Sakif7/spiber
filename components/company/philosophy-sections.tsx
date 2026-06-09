"use client";

import Image from "next/image";
import { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  Container,
  DotPattern,
  Eyebrow,
  Reveal,
  Section,
} from "@/components/ui";

type Pillar = { key: string; label: string; body: string };
type Value = { key: string; name: string; body: string };

/** Management-philosophy statement — copy (left) + a human-care photo (right). */
export function PhilosophyIntro() {
  const t = useTranslations("philosophy.intro");
  return (
    <Section style={{ background: "var(--color-surface)" }}>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.05fr 0.95fr",
            gap: "clamp(32px, 5vw, 72px)",
            alignItems: "center",
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
                  margin: "18px 0 22px",
                  maxWidth: "16ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                }}
              >
                {t("title")}
              </h2>
            </Reveal>
            <Reveal delay={170}>
              <p
                style={{
                  margin: 0,
                  fontSize: "var(--fs-body-lg)",
                  lineHeight: 1.75,
                  color: "var(--color-text-muted)",
                  maxWidth: "60ch",
                }}
              >
                {t("body")}
              </p>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 3",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--color-hairline)",
              }}
            >
              <Image
                src="/nurse-comforting-elderly-woman-home-care.jpeg"
                alt={t("imageAlt")}
                fill
                sizes="(max-width: 980px) 100vw, 46vw"
                style={{ objectFit: "cover", objectPosition: "center 30%" }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, transparent 58%, color-mix(in oklab, var(--brand-teal) 24%, transparent))",
                }}
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

/** Vision · Mission · Motto — three editorial text columns on a deep-teal band. */
export function PhilosophyPillars() {
  const t = useTranslations("philosophy.pillars");
  const items = t.raw("items") as Pillar[];
  return (
    <Section
      style={{
        background: "linear-gradient(140deg, var(--teal-800), var(--teal-900))",
        color: "#fff",
      }}
    >
      <DotPattern
        color="var(--teal-300)"
        gap={22}
        fade="radial"
        style={{ opacity: 0.16 }}
      />
      <Container style={{ position: "relative" }}>
        <Reveal>
          <Eyebrow dark>{t("eyebrow")}</Eyebrow>
        </Reveal>
        <Reveal delay={80}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: "var(--fs-h2)",
              lineHeight: 1.08,
              letterSpacing: "-.02em",
              color: "#fff",
              margin: "16px 0 0",
              maxWidth: "22ch",
            }}
          >
            {t("title")}
          </h2>
        </Reveal>
        <div
          className="equal-3col"
          style={{
            marginTop: "clamp(36px, 5vw, 60px)",
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "clamp(20px, 3vw, 44px)",
          }}
        >
          {items.map((it, i) => (
            <Reveal key={it.key} delay={i * 110}>
              <div style={{ position: "relative" }}>
                <span
                  aria-hidden
                  style={{
                    display: "block",
                    width: 44,
                    height: 3,
                    borderRadius: 2,
                    marginBottom: 22,
                    background:
                      "linear-gradient(90deg, var(--teal-300), var(--aqua-400))",
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    letterSpacing: ".16em",
                    color: "var(--aqua-300)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: "clamp(1.3rem, 1.1rem + 0.6vw, 1.6rem)",
                    letterSpacing: "-.01em",
                    margin: "8px 0 14px",
                    color: "#fff",
                  }}
                >
                  {it.label}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "var(--fs-body-lg)",
                    lineHeight: 1.7,
                    color: "rgba(255,255,255,0.78)",
                  }}
                >
                  {it.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/** Core Values — a stock image (left) + an icon-free value list (right). */
export function PhilosophyValues() {
  const t = useTranslations("philosophy.values");
  const items = t.raw("items") as Value[];
  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div
          className="values-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "0.92fr 1.08fr",
            gap: "clamp(32px, 5vw, 72px)",
            alignItems: "center",
          }}
        >
          <Reveal>
            <div
              style={{
                position: "relative",
                aspectRatio: "4 / 5",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                boxShadow: "var(--shadow-lg)",
                border: "1px solid var(--color-hairline)",
              }}
            >
              <Image
                src="/medical-team-thumbs-up-from-above.jpeg"
                alt={t("title")}
                fill
                sizes="(max-width: 980px) 100vw, 44vw"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, transparent 60%, color-mix(in oklab, var(--brand-teal) 30%, transparent))",
                }}
              />
            </div>
          </Reveal>

          <div>
            <Reveal>
              <Eyebrow>{t("eyebrow")}</Eyebrow>
            </Reveal>
            <Reveal delay={80}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: "var(--fs-h2)",
                  lineHeight: 1.08,
                  letterSpacing: "-.02em",
                  color: "var(--color-text-strong)",
                  margin: "16px 0 14px",
                  maxWidth: "18ch",
                }}
              >
                {t("title")}
              </h2>
            </Reveal>
            <Reveal delay={150}>
              <p
                style={{
                  margin: "0 0 28px",
                  fontSize: "var(--fs-body)",
                  lineHeight: 1.65,
                  color: "var(--color-text-muted)",
                  maxWidth: "56ch",
                }}
              >
                {t("body")}
              </p>
            </Reveal>
            <div
              className="values-list"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "18px 24px",
              }}
            >
              {items.map((it, i) => (
                <Reveal key={it.key} delay={180 + (i % 2) * 70}>
                  <div
                    style={{
                      paddingLeft: 16,
                      borderLeft: "2px solid var(--teal-300)",
                    }}
                  >
                    <h3
                      style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 600,
                        fontSize: 16,
                        color: "var(--color-text-strong)",
                        margin: "0 0 4px",
                      }}
                    >
                      {it.name}
                    </h3>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        lineHeight: 1.5,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {it.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </Container>
      <style>{`
        @media (max-width: 900px) {
          .values-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          .values-list { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </Section>
  );
}
