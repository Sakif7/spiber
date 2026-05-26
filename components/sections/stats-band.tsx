"use client";

import { Container, Eyebrow, Reveal, Section } from "@/components/ui";
import { useCountUp } from "@/hooks";

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
  return (
    <div
      ref={ref}
      style={{
        padding: "32px 0",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: "clamp(48px, 5vw, 88px)",
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
              fontSize: "0.55em",
              color: "var(--color-secondary)",
              marginLeft: 4,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 500,
          fontSize: 13,
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--color-text)",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
        {sub}
      </div>
    </div>
  );
}

export function StatsBand() {
  return (
    <Section py="clamp(64px, 7vw, 112px)">
      <Container>
        <div style={{ marginBottom: 32 }}>
          <Reveal>
            <Eyebrow>IMPACT · 2026</Eyebrow>
          </Reveal>
        </div>
        <div
          className="equal-4col"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 36,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <Reveal>
            <Stat
              value={248}
              suffix="+"
              label="Completed projects"
              sub="Across 8 divisions of Bangladesh"
            />
          </Reveal>
          <Reveal delay={120}>
            <Stat
              value={2400}
              label="Happy clients"
              sub="Hospitals · clinics · labs · academies"
            />
          </Reveal>
          <Reveal delay={240}>
            <Stat value={14} label="Countries" sub="OEM & service partnerships" />
          </Reveal>
          <Reveal delay={360}>
            <Stat
              value={99.4}
              suffix="%"
              decimals={1}
              label="Positive reviews"
              sub="From 2,400+ verified clients"
            />
          </Reveal>
        </div>

        <Reveal delay={400}>
          <div
            style={{
              marginTop: 80,
              paddingTop: 32,
              borderTop: "1px solid var(--color-hairline)",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".16em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                textAlign: "center",
                marginBottom: 28,
              }}
            >
              OEM &amp; ACADEMIC PARTNERS — 60+ ACROSS 14 COUNTRIES
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
                "MINDRAY",
                "DRÄGER",
                "MEDTRONIC",
                "GE HEALTH",
                "MAQUET",
                "STRYKER",
                "OLYMPUS",
                "PHILIPS",
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
