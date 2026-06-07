"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Container, DotPattern, Reveal, Section } from "@/components/ui";
import { useCountUp } from "@/hooks";

/**
 * Impact band — the SAME four figures the homepage StatsBand publishes
 * (read from the shared `home.stats` namespace so labels stay in sync):
 * 100+ / 120+ / 3+ / 250+. Rendered as count-up progress rings.
 */
const VALUES = [100, 120, 3, 250];

const RING_R = 54;
const RING_C = 2 * Math.PI * RING_R;
const RING_ARC = 0.72;

function Stat({
  value,
  label,
  sub,
  delay,
}: {
  value: number;
  label: string;
  sub: string;
  delay: number;
}) {
  const [ref, val] = useCountUp(value, 1500);
  const rawId = useId();
  const gid = "aboutRing" + rawId.replace(/[^a-z0-9]/gi, "");
  return (
    <Reveal delay={delay}>
      <div
        ref={ref}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: 18,
        }}
      >
        <div style={{ position: "relative", width: 132, height: 132 }}>
          <svg
            width="132"
            height="132"
            viewBox="0 0 120 120"
            style={{ transform: "rotate(-90deg)" }}
            aria-hidden
          >
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="var(--aqua-300)" />
              </linearGradient>
            </defs>
            <circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              strokeWidth="5"
            />
            <circle
              cx="60"
              cy="60"
              r={RING_R}
              fill="none"
              stroke={`url(#${gid})`}
              strokeWidth="5"
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
                fontWeight: 600,
                fontSize: "clamp(30px, 3vw, 40px)",
                lineHeight: 1,
                letterSpacing: "-.03em",
                color: "#fff",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {val}
              <span style={{ color: "var(--orange-300)", marginLeft: 1 }}>
                +
              </span>
            </div>
          </div>
        </div>
        <div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              fontSize: 15,
              color: "#fff",
              marginBottom: 4,
            }}
          >
            {label}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: "rgba(255,255,255,0.72)",
              lineHeight: 1.45,
              maxWidth: "22ch",
            }}
          >
            {sub}
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function AboutStats() {
  const t = useTranslations("home.stats");
  const items = t.raw("items") as Array<{ label: string; sub: string }>;

  return (
    <Section
      style={{
        background: "linear-gradient(105deg, var(--teal-600), var(--teal-800))",
        color: "#fff",
      }}
      py="clamp(60px, 6.5vw, 104px)"
    >
      <DotPattern
        color="var(--teal-300)"
        gap={20}
        fade="radial"
        style={{ opacity: 0.16 }}
      />
      <Container style={{ position: "relative" }}>
        <div
          className="equal-4col"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 32,
          }}
        >
          {items.map((it, i) => (
            <Stat
              key={it.label}
              value={VALUES[i]}
              label={it.label}
              sub={it.sub}
              delay={i * 110}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
