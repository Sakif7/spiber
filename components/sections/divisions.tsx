"use client";

import { CSSProperties, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Arrow,
  Container,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";

type Tone = "teal" | "orange";

type Division = {
  key: string;
  tone: Tone;
  href: string;
  image: string;
  imageAlt: string;
  tag?: string;
  big?: boolean;
};

// Bento: Instruments is the flagship (spans both rows); products are teal,
// services are orange. Order matches the grid placement below.
const DIVISIONS: Division[] = [
  {
    key: "instruments",
    tone: "teal",
    href: "/medtrade",
    image: "/modern-operating-room-equipment.jpeg",
    imageAlt: "Operating theatre fitted with clinical-grade equipment",
    tag: "FLAGSHIP",
    big: true,
  },
  {
    key: "systems",
    tone: "teal",
    href: "/digihealth",
    image: "/bento-software.png",
    imageAlt: "Hospital information and telemedicine dashboards on screen",
  },
  {
    key: "academy",
    tone: "orange",
    href: "/medacademy",
    image: "/cpr-training-manikin-with-aed.jpeg",
    imageAlt: "Hands-on resuscitation training with a manikin and AED",
  },
  {
    key: "tourism",
    tone: "orange",
    href: "/tourism",
    image: "/cherry-blossom-tree-lined-road.jpeg",
    imageAlt: "Tree-lined road abroad, evoking medical travel",
  },
  {
    key: "health-corner",
    tone: "orange",
    href: "/health-corner",
    image: "/nurse-comforting-elderly-woman-home-care.jpeg",
    imageAlt: "A nurse supporting an elderly patient at home",
  },
];

const TONE: Record<
  Tone,
  { line: string; lineHover: string; kicker: string; bar: string; glow: string }
> = {
  teal: {
    line: "var(--teal-100)",
    lineHover: "var(--teal-300)",
    kicker: "var(--color-brand-deep)",
    bar: "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
    glow: "0 18px 40px -16px color-mix(in oklab, var(--brand-teal) 42%, transparent)",
  },
  orange: {
    line: "var(--orange-100)",
    lineHover: "var(--orange-300)",
    kicker: "var(--orange-700)",
    bar: "linear-gradient(90deg, var(--orange-500), var(--orange-300))",
    glow: "0 18px 40px -16px color-mix(in oklab, var(--orange-500) 42%, transparent)",
  },
};

export function Divisions() {
  const t = useTranslations("home.divisions");

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div style={{ marginBottom: 48 }}>
          <SectionTitle
            eyebrow={t("eyebrow")}
            title={t("title")}
            lede={t("lede")}
          />
        </div>

        <div
          className="seg-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1fr 1fr",
            gridTemplateRows: "auto auto",
            gap: 16,
          }}
        >
          <Reveal style={{ gridRow: "span 2" }}>
            <DivisionCard d={DIVISIONS[0]} />
          </Reveal>
          {DIVISIONS.slice(1).map((d, i) => (
            <Reveal key={d.key} delay={80 + i * 80}>
              <DivisionCard d={d} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function DivisionCard({ d }: { d: Division }) {
  const hubs = useTranslations("hubs");
  const t = useTranslations("home.divisions");
  const [hover, setHover] = useState(false);
  const c = TONE[d.tone];
  const big = !!d.big;

  return (
    <Link
      href={d.href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      style={{
        position: "relative",
        height: "100%",
        minHeight: big ? 520 : 250,
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        background: "var(--color-surface)",
        border: "1px solid " + (hover ? c.lineHover : c.line),
        display: "flex",
        flexDirection: "column",
        boxShadow: hover ? c.glow : "var(--shadow-xs)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition:
          "transform 320ms var(--ease-out-expo), box-shadow 320ms var(--ease-out-expo), border-color 320ms var(--ease-out-expo)",
        textDecoration: "none",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          zIndex: 3,
          background: c.bar,
          transform: hover ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transition: "transform 420ms var(--ease-out-expo)",
        }}
      />
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: big ? 360 : 150,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: hover ? "scale(1.06)" : "scale(1)",
            transition: "transform 700ms var(--ease-out-expo)",
          }}
        >
          <Image
            src={d.image}
            alt={d.imageAlt}
            fill
            sizes={
              big
                ? "(max-width: 900px) 90vw, 600px"
                : "(max-width: 900px) 45vw, 300px"
            }
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
        </div>
        {d.tag && (
          <span
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              background: "var(--color-secondary)",
              color: "white",
              fontSize: 11,
              fontWeight: 600,
              padding: "5px 11px",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              letterSpacing: ".1em",
            }}
          >
            {d.tag}
          </span>
        )}
      </div>

      <div style={{ padding: big ? 32 : 22 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: c.kicker,
            marginBottom: 10,
          }}
        >
          {hubs(`${d.key}.eyebrow`)}
        </div>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: big ? 28 : 18,
            letterSpacing: "-.015em",
            lineHeight: 1.18,
            color: "var(--color-text-strong)",
            margin: "0 0 10px",
            maxWidth: "24ch",
            textWrap: "balance" as CSSProperties["textWrap"],
          }}
        >
          {hubs(`${d.key}.title`)}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: big ? 15 : 13,
            lineHeight: 1.55,
            color: "var(--color-text-muted)",
            maxWidth: "56ch",
          }}
        >
          {hubs(`${d.key}.description`)}
        </p>

        <span
          style={{
            marginTop: big ? 22 : 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: c.kicker,
            transform: hover ? "translateX(2px)" : "translateX(0)",
            transition: "transform 280ms var(--ease-out-expo)",
          }}
        >
          {t("explore")} <Arrow size={12} />
        </span>
      </div>
    </Link>
  );
}
