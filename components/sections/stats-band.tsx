"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import {
  Container,
  DotPattern,
  Eyebrow,
  Reveal,
  Section,
} from "@/components/ui";
import { useCountUp } from "@/hooks";

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const RING_ARC = 0.72;

function Stat({
  value,
  suffix,
  decimals,
  label,
  sub,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  label: string;
  sub: string;
}) {
  const [ref, val] = useCountUp(value, 1500, decimals);
  const rawId = useId();
  const gid = "ring" + rawId.replace(/[^a-z0-9]/gi, "");
  return (
    <div
      ref={ref}
      style={{
        padding: "8px 0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 20,
      }}
    >
      <div style={{ position: "relative", width: 150, height: 150 }}>
        <svg
          width="150"
          height="150"
          viewBox="0 0 120 120"
          style={{ transform: "rotate(-90deg)" }}
          aria-hidden
        >
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--aqua-400)" />
              <stop offset="100%" stopColor="var(--brand-teal)" />
            </linearGradient>
          </defs>
          <circle
            cx="60"
            cy="60"
            r={RING_R}
            fill="none"
            stroke="var(--teal-100)"
            strokeWidth="3"
          />
          <circle
            cx="60"
            cy="60"
            r={RING_R}
            fill="none"
            stroke={`url(#${gid})`}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${RING_C * RING_ARC} ${RING_C}`}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontSize: "clamp(34px, 3.4vw, 46px)",
              lineHeight: 1,
              letterSpacing: "-.03em",
              color: "var(--color-text-strong)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {val}
            {suffix && (
              <span
                style={{
                  fontSize: "0.5em",
                  color: "var(--color-secondary)",
                  marginLeft: 2,
                }}
              >
                {suffix}
              </span>
            )}
          </div>
        </div>
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: "var(--color-text-strong)",
            marginBottom: 6,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--color-text-muted)",
            lineHeight: 1.5,
          }}
        >
          {sub}
        </div>
      </div>
    </div>
  );
}

export function StatsBand() {
  const t = useTranslations("home.stats");
  const items = t.raw("items") as Array<{ label: string; sub: string }>;
  return (
    <Section py="clamp(64px, 7vw, 112px)">
      <Container>
        <div style={{ marginBottom: 32 }}>
          <Reveal>
            <Eyebrow>{t("eyebrow")}</Eyebrow>
          </Reveal>
        </div>
        <div style={{ position: "relative" }}>
          <DotPattern
            color="var(--teal-200)"
            gap={22}
            fade="radial"
            style={{ opacity: 0.6 }}
          />
          <div
            className="equal-4col"
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 36,
            }}
          >
            <Reveal>
              <Stat
                value={100}
                suffix="+"
                label={items[0].label}
                sub={items[0].sub}
              />
            </Reveal>
            <Reveal delay={120}>
              <Stat
                value={120}
                suffix="+"
                label={items[1].label}
                sub={items[1].sub}
              />
            </Reveal>
            <Reveal delay={240}>
              <Stat
                value={3}
                suffix="+"
                label={items[2].label}
                sub={items[2].sub}
              />
            </Reveal>
            <Reveal delay={360}>
              <Stat
                value={250}
                suffix="+"
                label={items[3].label}
                sub={items[3].sub}
              />
            </Reveal>
          </div>
        </div>

        <Reveal delay={400}>
          <div
            style={{
              marginTop: 80,
              paddingTop: 32,
              borderTop: "1px solid var(--teal-100)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "var(--color-brand-deep)",
                textAlign: "center",
                marginBottom: 28,
              }}
            >
              {t("trustedBy")}
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 32,
                opacity: 0.55,
                filter: "grayscale(1)",
              }}
            >
              {[
                "AICHI HEALTHCARE GROUP",
                "TOP MRI & MEDICTO",
                "MIRROR HOSPITAL",
                "EAST WEST MEDICAL",
                "SQUARE HOSPITALS",
                "LABAID HOSPITAL",
                "UNITED HOSPITAL",
                "EVERCARE HOSPITAL",
              ].map((p) => (
                <div
                  key={p}
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: ".06em",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {p}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
