"use client";

import { CSSProperties, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Microscope,
  MonitorSmartphone,
  GraduationCap,
  Plane,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Arrow } from "@/components/ui";
import { useMagnetic } from "@/hooks";
import DotGrid from "@/components/ui/dot-grid";
import { Link } from "@/i18n/navigation";

const MotionLink = motion.create(Link);
const EASE = [0.16, 1, 0.3, 1] as const;

type Division = {
  id: string;
  area: "tl" | "tr" | "ml" | "mr" | "cc";
  side: "left" | "right";
  href: string;
  image: string;
  Icon: LucideIcon;
};

// Bento placement: Instruments TL, Systems TR, Academy ML, Tourism MR,
// Consulting bottom-center. The center column (text) spans the two top rows.
const DIVISIONS: Division[] = [
  {
    id: "instruments",
    area: "tl",
    side: "left",
    href: "/instruments",
    image: "/modern-operating-room-equipment.jpeg",
    Icon: Microscope,
  },
  {
    id: "systems",
    area: "tr",
    side: "left",
    href: "/systems",
    image: "/bento-software.png",
    Icon: MonitorSmartphone,
  },
  {
    id: "academy",
    area: "ml",
    side: "left",
    href: "/academy",
    image: "/cpr-training-manikin-with-aed.jpeg",
    Icon: GraduationCap,
  },
  {
    id: "tourism",
    area: "mr",
    side: "left",
    href: "/tourism",
    image: "/cherry-blossom-tree-lined-road.jpeg",
    Icon: Plane,
  },
  {
    id: "consulting",
    area: "cc",
    side: "left",
    href: "/consulting",
    image: "/manager-reviewing-work-with-employee-computer.jpeg",
    Icon: Users,
  },
];

// Staggered, varied so cards never drift in unison. Gated to no-preference.
const FLOAT: Record<Division["area"], { dur: number; delay: number }> = {
  tl: { dur: 6.2, delay: -0.3 },
  tr: { dur: 6.9, delay: -1.6 },
  ml: { dur: 5.8, delay: -2.7 },
  mr: { dur: 7.2, delay: -0.9 },
  cc: { dur: 6.5, delay: -3.5 },
};

const HERO_PARTNERS = [
  "Aichi Healthcare Group",
  "TOP MRI & Medicto",
  "Mirror Hospital",
  "East West Medical",
  "Square Hospitals",
  "Labaid Hospital",
  "United Hospital",
  "Evercare Hospital",
  "Ibn Sina Hospital",
  "Popular Diagnostic",
  "Birdem General",
];

function Check() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--brand-teal)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

function HeroBackground({ hoveredId }: { hoveredId: string | null }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <DotGrid
        dotSize={4}
        gap={26}
        baseColor="#D2EDEB"
        activeColor="#0E8B86"
        proximity={140}
        style={{ pointerEvents: "auto" }}
      />

      <motion.div
        animate={{ opacity: hoveredId ? 0.12 : 0.42 }}
        transition={{ duration: 0.6, ease: EASE }}
        className="hero-blob"
        style={{
          width: 460,
          height: 460,
          top: 40,
          right: -120,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand-orange) 18%, transparent), transparent 70%)",
          animationDelay: "-8s",
        }}
      />

      {DIVISIONS.map((d) => (
        <motion.div
          key={d.id}
          initial={false}
          animate={{ opacity: hoveredId === d.id ? 1 : 0 }}
          transition={{ duration: 0.7, ease: EASE }}
          style={{ position: "absolute", inset: 0 }}
        >
          <Image
            src={d.image}
            alt=""
            fill
            sizes="100vw"
            style={{
              objectFit: "cover",
              objectPosition: "center",
              filter: "saturate(.85)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(120% 90% at 50% 45%, color-mix(in oklab, var(--color-surface) 86%, transparent) 0%, color-mix(in oklab, var(--color-surface) 78%, transparent) 45%, color-mix(in oklab, var(--color-surface) 55%, transparent) 100%)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function DivisionTile({
  d,
  index,
  onHover,
  reduce,
}: {
  d: Division;
  index: number;
  onHover: (id: string | null) => void;
  reduce: boolean;
}) {
  const hubs = useTranslations("hubs");
  const cards = useTranslations("home.hero.cards");
  const f = FLOAT[d.area];
  const Icon = d.Icon;

  return (
    <div className={`hb-${d.area}`} style={{ position: "relative" }}>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: reduce ? 0 : 0.42 + index * 0.08,
          duration: 0.6,
          ease: EASE,
        }}
      >
        <div
          className="hero-float"
          style={{
            position: "relative",
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          <MotionLink
            href={d.href}
            whileHover="hover"
            onMouseEnter={() => onHover(d.id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(d.id)}
            onBlur={() => onHover(null)}
            style={{
              position: "relative",
              display: "block",
              minHeight: 200,
              height: "100%",
              borderRadius: 22,
              overflow: "hidden",
              textDecoration: "none",
              color: "white",
              background: "var(--slate-900)",
              boxShadow:
                "0 1px 2px rgba(10,31,44,.05), 0 24px 60px -26px rgba(10,31,44,.30), 0 0 0 1px rgba(10,31,44,.06)",
            }}
          >
            <motion.div
              variants={{ hover: { scale: 1.06 } }}
              transition={{ duration: 0.7, ease: EASE }}
              style={{ position: "absolute", inset: 0 }}
            >
              <Image
                src={d.image}
                alt={cards(`${d.id}.imageAlt`)}
                fill
                sizes="(max-width: 1024px) 45vw, 280px"
                style={{ objectFit: "cover", objectPosition: "center" }}
              />
            </motion.div>
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(2,8,11,0.05) 0%, rgba(2,8,11,0.28) 42%, rgba(2,8,11,0.84) 100%)",
              }}
            />
            <motion.span
              variants={{ hover: { x: 3, y: -3 } }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              style={{
                position: "absolute",
                top: 14,
                right: 14,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 30,
                height: 30,
                borderRadius: 999,
                background: "rgba(255,255,255,0.94)",
                color: "var(--color-text-strong)",
              }}
            >
              <Arrow size={12} />
            </motion.span>
            <div
              style={{ position: "absolute", left: 16, right: 16, bottom: 14 }}
            >
              <h3
                style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                  fontSize: 18,
                  letterSpacing: "-.012em",
                  lineHeight: 1.1,
                  margin: 0,
                  color: "white",
                }}
              >
                {hubs(`${d.id}.title`)}
              </h3>
              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: 12.5,
                  lineHeight: 1.45,
                  color: "rgba(255,255,255,.82)",
                }}
              >
                {cards(`${d.id}.blurb`)}
              </p>
            </div>
          </MotionLink>

          <span
            aria-hidden
            className="hero-badge"
            style={{
              position: "absolute",
              top: -14,
              [d.side === "right" ? "right" : "left"]: -14,
              display: "grid",
              placeItems: "center",
              width: 44,
              height: 44,
              borderRadius: 999,
              background: "var(--color-surface)",
              color: "var(--color-brand-deep)",
              boxShadow:
                "0 8px 18px -8px rgba(10,31,44,.28), 0 0 0 1px var(--color-hairline)",
            }}
          >
            <Icon size={20} strokeWidth={1.8} />
          </span>
        </div>
      </motion.div>
    </div>
  );
}

function CenterContent({ reduce }: { reduce: boolean }) {
  const t = useTranslations("home.hero");
  const ctaMag = useMagnetic<HTMLAnchorElement>(0.22, 90);
  const trust = t.raw("trust") as string[];

  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: reduce ? 0 : delay, duration: 0.6, ease: EASE },
  });

  return (
    <div
      className="hb-center"
      style={{ textAlign: "center", padding: "8px clamp(0px, 1vw, 16px)" }}
    >
      <motion.h1
        {...rise(0)}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 4.6vw, 84px)",
          fontWeight: 500,
          lineHeight: 1.02,
          letterSpacing: "-0.035em",
          margin: 0,
          color: "var(--color-text-strong)",
          textWrap: "balance" as CSSProperties["textWrap"],
        }}
      >
        {t("titleLine1")}
        <br />
        <span style={{ color: "var(--brand-teal)" }}>{t("titleLine2")}</span>
      </motion.h1>

      <motion.p
        {...rise(0.16)}
        style={{
          margin: "20px auto 0",
          maxWidth: "52ch",
          fontSize: "clamp(15px, 1.25vw, 18px)",
          lineHeight: 1.6,
          color: "var(--color-text-muted)",
        }}
      >
        {t("subcopy")}
      </motion.p>

      <motion.div
        {...rise(0.24)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 12,
          marginTop: 30,
        }}
      >
        <Link
          href="/instruments"
          className="hero-cta-ghost"
          style={{
            background: "transparent",
            color: "var(--color-text-strong)",
            border: "1px solid var(--color-border)",
            borderRadius: 999,
            padding: "0 20px",
            height: 46,
            fontSize: 14,
            fontWeight: 500,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            transition: "border-color .25s, background .25s",
          }}
        >
          {t("ctaExplore")} <Arrow size={14} />
        </Link>
        <Link
          ref={ctaMag}
          href="/contact"
          style={{
            background: "var(--color-brand)",
            color: "white",
            border: "none",
            borderRadius: 999,
            padding: "0 22px",
            height: 46,
            fontSize: 14,
            fontWeight: 500,
            boxShadow:
              "0 10px 24px -8px color-mix(in oklab, var(--brand-teal) 60%, transparent)",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {t("ctaQuote")} <Arrow size={14} />
        </Link>
      </motion.div>

      <motion.div
        {...rise(0.3)}
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "10px 22px",
          marginTop: 26,
          color: "var(--color-text-muted)",
          fontSize: 13,
        }}
      >
        {trust.map((item) => (
          <span
            key={item}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Check />
            {item}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

function PartnerMarquee() {
  return (
    <div
      style={{
        borderTop: "1px solid var(--teal-100)",
        paddingTop: 26,
        marginTop: 56,
        display: "flex",
        overflow: "hidden",
        maskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 64,
          animation: "heroMarquee 40s linear infinite",
          flexShrink: 0,
          paddingRight: 64,
        }}
      >
        {[...HERO_PARTNERS, ...HERO_PARTNERS].map((p, i) => (
          <div
            key={i}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 18,
              color: "var(--color-text-muted)",
              letterSpacing: "-0.01em",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  const reduce = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        paddingTop: "clamp(36px, 5vw, 64px)",
        paddingBottom: "clamp(40px, 6vw, 80px)",
        background: "var(--color-surface)",
      }}
    >
      <HeroBackground hoveredId={hovered} />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 1800,
          margin: "0 auto",
          paddingInline: "clamp(20px, 4vw, 72px)",
        }}
      >
        <div
          className="hero-bento"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 0.85fr) minmax(0, 1.9fr) minmax(0, 0.85fr)",
            gridTemplateAreas: '"tl center tr" "ml center mr" ". cc ."',
            alignItems: "center",
            gap: "clamp(18px, 2.2vw, 40px)",
          }}
        >
          <CenterContent reduce={reduce} />
          {DIVISIONS.map((d, i) => (
            <DivisionTile
              key={d.id}
              d={d}
              index={i}
              onHover={setHovered}
              reduce={reduce}
            />
          ))}
        </div>

        <PartnerMarquee />
      </div>

      <style>{`
        .hb-center { grid-area: center; }
        .hb-tl { grid-area: tl; }
        .hb-tr { grid-area: tr; }
        .hb-ml { grid-area: ml; }
        .hb-mr { grid-area: mr; }
        .hb-cc { grid-area: cc; max-width: 360px; justify-self: center; width: 100%; }
        .hero-cta-ghost:hover { border-color: var(--brand-teal); background: var(--color-surface); }
        /* V layout: drop the mid cards down + pull them toward the centre text. */
        @media (min-width: 1025px) {
          .hb-ml { transform: translate(46px, 54px); }
          .hb-mr { transform: translate(-46px, 54px); }
        }
        @keyframes heroFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @media (prefers-reduced-motion: no-preference) {
          .hero-float { animation-name: heroFloat; animation-timing-function: ease-in-out; animation-iteration-count: infinite; }
        }
        @media (max-width: 1024px) {
          .hero-bento {
            grid-template-columns: 1fr 1fr !important;
            grid-template-areas: none !important;
          }
          .hb-center { grid-area: auto; grid-column: 1 / -1; margin-bottom: 8px; }
          .hb-tl, .hb-tr, .hb-ml, .hb-mr, .hb-cc { grid-area: auto; }
          .hb-cc { max-width: none; }
        }
        @media (max-width: 600px) {
          .hero-bento { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
