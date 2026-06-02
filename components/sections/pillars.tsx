"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Arrow,
  Container,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";
import ScrollStack, { ScrollStackItem } from "@/components/ui/scroll-stack";
import { Link } from "@/i18n/navigation";

const MotionLink = motion.create(Link);

type PillarStatic = {
  n: string;
  metricValue: string;
  ctaHref: string;
  image: string;
  imagePosition?: string;
};

type PillarText = {
  category: string;
  title: string;
  body: string;
  metricLabel: string;
  ctaLabel: string;
  imageAlt: string;
};

const ITEMS: PillarStatic[] = [
  {
    n: "01",
    metricValue: "248",
    ctaHref: "/tourism",
    image: "/smiling-medical-team-portrait.jpeg",
    imagePosition: "center 30%",
  },
  {
    n: "02",
    metricValue: "60+",
    ctaHref: "/instruments",
    image: "/modern-operating-room-equipment.jpeg",
    imagePosition: "center center",
  },
  {
    n: "03",
    metricValue: "14k+",
    ctaHref: "/about",
    image: "/nurse-holding-patient-hand-reassurance.jpeg",
    imagePosition: "center center",
  },
  {
    n: "04",
    metricValue: "120+",
    ctaHref: "/contact",
    image: "/lab-technician-using-analyzer-machine.jpeg",
    imagePosition: "center center",
  },
];

const CARD_CLASS =
  "!bg-[color:var(--color-surface)] !border !border-[color:var(--teal-100)] " +
  "!shadow-[0_24px_60px_-28px_rgba(14,139,134,0.28)] !rounded-[32px] " +
  "!p-0 !h-96 !mt-0 overflow-hidden";

export function Pillars() {
  const t = useTranslations("home.pillars");
  const [stackComplete, setStackComplete] = useState(false);
  const itemsText = t.raw("items") as PillarText[];
  return (
    <Section style={{ overflow: "visible" }}>
      <Container>
        <div
          className="pillars-sticky-top"
          style={{
            position: "sticky",
            top: 84,
            zIndex: 5,
            background: "var(--color-bg)",
            paddingBottom: 32,
          }}
        >
          <div
            className="pillars-headline-row"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 32,
              alignItems: "end",
            }}
          >
            <SectionTitle
              eyebrow={t("eyebrow")}
              title={t("title")}
              lede={t("lede")}
            />
            <Reveal delay={200}>
              <Link
                href="/consulting"
                style={{
                  background: "var(--color-surface)",
                  color: "var(--color-text-strong)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 999,
                  padding: "12px 22px",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  whiteSpace: "nowrap",
                }}
              >
                {t("exploreServices")} <Arrow />
              </Link>
            </Reveal>
          </div>
        </div>

        <div
          style={{
            opacity: stackComplete ? 0 : 1,
            transition: "opacity 380ms cubic-bezier(.16,1,.3,1)",
            willChange: "opacity",
          }}
        >
          <ScrollStack
            useWindowScroll
            itemDistance={120}
            itemStackDistance={10}
            baseScale={0.94}
            itemScale={0.02}
            stackPosition="38%"
            scaleEndPosition="14%"
            completeOffset={260}
            innerClassName="pt-0 pb-[10rem]"
            onStackComplete={setStackComplete}
          >
            {ITEMS.map((it, idx) => (
              <ScrollStackItem key={it.n} itemClassName={CARD_CLASS}>
                <PillarCardContent
                  {...it}
                  {...itemsText[idx]}
                  pillarLabel={t("pillarLabel")}
                  total={ITEMS.length}
                  index={idx}
                />
              </ScrollStackItem>
            ))}
          </ScrollStack>
        </div>
      </Container>

      <style>{`
        @media (max-width: 720px) {
          .pillars-headline-row { grid-template-columns: 1fr !important; align-items: start !important; }
          .pillars-card-image { display: none !important; }
          .pillars-card-content { width: 100% !important; padding-right: 40px !important; }
        }
      `}</style>
    </Section>
  );
}

function PillarCardContent({
  n,
  category,
  title,
  body,
  metricValue,
  metricLabel,
  ctaLabel,
  ctaHref,
  image,
  imageAlt,
  imagePosition,
  pillarLabel,
  total,
}: PillarStatic &
  PillarText & { pillarLabel: string; total: number; index: number }) {
  return (
    <div
      style={{
        position: "relative",
        height: "100%",
        width: "100%",
      }}
    >
      <div
        className="pillars-card-image"
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "52%",
          pointerEvents: "none",
        }}
      >
        <Image
          src={image}
          alt={imageAlt}
          fill
          sizes="(max-width: 720px) 0px, (max-width: 1240px) 38vw, 540px"
          style={{
            objectFit: "cover",
            objectPosition: imagePosition ?? "center",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to right, var(--color-surface) 0%, color-mix(in srgb, var(--color-surface) 70%, transparent) 25%, transparent 55%)",
          }}
        />
      </div>

      <div
        className="pillars-card-content"
        style={{
          position: "relative",
          zIndex: 1,
          height: "100%",
          width: "62%",
          padding: "36px 0 32px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 22,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: ".18em",
              textTransform: "uppercase",
            }}
          >
            <span style={{ color: "var(--color-brand)" }}>{category}</span>
            <span
              aria-hidden
              style={{
                width: 18,
                height: 1,
                background: "var(--color-border)",
              }}
            />
            <span style={{ color: "var(--color-text-muted)" }}>
              {pillarLabel} {n} / 0{total}
            </span>
          </div>

          <h3
            style={{
              fontFamily: "var(--font-display)",
              fontWeight: 500,
              fontSize: "clamp(26px, 2.4vw, 34px)",
              letterSpacing: "-.022em",
              lineHeight: 1.1,
              color: "var(--color-text-strong)",
              margin: 0,
              maxWidth: "22ch",
              textWrap: "balance",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "16px 0 0",
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--color-text-muted)",
              maxWidth: "44ch",
            }}
          >
            {body}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            paddingTop: 22,
            borderTop: "1px solid var(--color-hairline)",
            gap: 22,
            flexWrap: "wrap",
            maxWidth: "92%",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: 26,
                letterSpacing: "-.02em",
                color: "var(--color-text-strong)",
                lineHeight: 1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {metricValue}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                lineHeight: 1.35,
                maxWidth: "22ch",
              }}
            >
              {metricLabel}
            </span>
          </div>

          <span
            aria-hidden
            style={{
              width: 1,
              height: 22,
              background: "var(--teal-200)",
              flexShrink: 0,
            }}
          />

          <MotionLink
            href={ctaHref}
            initial="rest"
            whileHover="hover"
            animate="rest"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              color: "var(--color-brand-deep)",
              fontSize: 13.5,
              fontWeight: 500,
              textDecoration: "none",
              whiteSpace: "nowrap",
              transition: "color .25s",
            }}
            className="pillar-cta"
          >
            {ctaLabel}
            <motion.span
              variants={{ rest: { x: 0 }, hover: { x: 4 } }}
              transition={{ type: "spring", stiffness: 380, damping: 24 }}
              style={{ display: "inline-flex" }}
            >
              <Arrow size={12} />
            </motion.span>
          </MotionLink>
        </div>
      </div>

      <style>{`
        .pillar-cta:hover { color: var(--color-brand) !important; }
      `}</style>
    </div>
  );
}
