"use client";

import { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import {
  Arrow,
  Container,
  DotPattern,
  Eyebrow,
  Reveal,
  Section,
} from "@/components/ui";
import { useMagnetic } from "@/hooks";
import { Link } from "@/i18n/navigation";

export function CTABand() {
  const t = useTranslations("home.cta");
  const cta = useMagnetic<HTMLAnchorElement>(0.3, 100);
  return (
    <Section dark mesh py="clamp(80px, 9vw, 160px)">
      <DotPattern
        color="var(--teal-300)"
        gap={20}
        fade="radial"
        style={{
          inset: "auto",
          top: -60,
          right: -40,
          width: 460,
          height: 460,
          opacity: 0.22,
        }}
      />
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr",
            gap: 48,
            alignItems: "center",
          }}
        >
          <div>
            <Reveal>
              <Eyebrow dark>{t("eyebrow")}</Eyebrow>
            </Reveal>
            <Reveal delay={100}>
              <h2
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 500,
                  fontSize: "var(--fs-display)",
                  lineHeight: 1.02,
                  letterSpacing: "-.03em",
                  margin: "16px 0 24px",
                  maxWidth: "16ch",
                  textWrap: "balance" as CSSProperties["textWrap"],
                  color: "white",
                }}
              >
                {t("heading")}
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p
                style={{
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.7)",
                  maxWidth: "52ch",
                  margin: 0,
                }}
              >
                {t("description")}
              </p>
            </Reveal>
          </div>
          <Reveal delay={300}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                alignItems: "flex-start",
              }}
            >
              <Link
                href="/contact"
                ref={cta}
                style={{
                  background: "var(--color-brand)",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "18px 28px",
                  fontSize: 16,
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow: "var(--shadow-brand)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {t("requestQuote")} <Arrow size={16} />
              </Link>
              <Link
                href="/contact"
                style={{
                  background: "transparent",
                  color: "white",
                  border:
                    "1px solid color-mix(in srgb, var(--teal-300) 55%, transparent)",
                  borderRadius: 999,
                  padding: "16px 26px",
                  fontSize: 15,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {t("scheduleCall")} <Arrow />
              </Link>
              <a
                href="mailto:sales@spibermed.com"
                style={{
                  marginTop: 8,
                  fontSize: 14,
                  color: "var(--teal-300)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {t("emailPrefix")} · sales@spibermed.com →
              </a>
            </div>
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}
