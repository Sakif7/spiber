"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Arrow,
  Container,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";
import ScrollStack, { ScrollStackItem } from "@/components/ui/scroll-stack";

type Pillar = {
  n: string;
  category: string;
  title: string;
  body: string;
  metric: { value: string; label: string };
  ctaLabel: string;
  ctaHref: string;
  image: string;
  imageAlt: string;
  imagePosition?: string;
};

const ITEMS: Pillar[] = [
  {
    n: "01",
    category: "Partnership",
    title: "A trusted long-term ally to every hospital we work with.",
    body: "Procurement, planning, training, and post-installation service — handled end-to-end, so clinical teams stay focused on patients. The relationship continues long after the equipment is in the ward.",
    metric: { value: "248", label: "Partner hospitals · 8 divisions" },
    ctaLabel: "View partner hospitals",
    ctaHref: "#hospitals",
    image: "/smiling-medical-team-portrait.jpeg",
    imageAlt: "Medical team standing together in a hospital corridor",
    imagePosition: "center 30%",
  },
  {
    n: "02",
    category: "Equipment",
    title: "Clinical-grade tools, calibrated for real workloads.",
    body: "From OR tables to OEM-sourced imaging suites — each line is chosen for clinical accuracy, serviceability, and a 7–10 year operating life. Spec sheets are the easy part; what survives a third shift in a busy ward is the hard part.",
    metric: { value: "60+", label: "OEM partners across 14 countries" },
    ctaLabel: "Browse the catalogue",
    ctaHref: "#products",
    image: "/modern-operating-room-equipment.jpeg",
    imageAlt: "Modern operating room with surgical robotics and imaging systems",
    imagePosition: "center center",
  },
  {
    n: "03",
    category: "Outreach",
    title: "Healthcare that doesn't depend on a postcode.",
    body: "Equipment donations, screening camps, and clinician training in the districts the supply chain usually forgets. Impact is measured in training hours delivered and kilometres covered — not photo opportunities.",
    metric: { value: "14k+", label: "Training hours delivered" },
    ctaLabel: "Read the CSR brief",
    ctaHref: "#csr",
    image: "/nurse-holding-patient-hand-reassurance.jpeg",
    imageAlt: "Nurse holding a patient's hand in reassurance",
    imagePosition: "center center",
  },
  {
    n: "04",
    category: "Talent",
    title: "Local engineers, international standards.",
    body: "Hands-on apprenticeships, OEM certification, and overseas postings for biomedical engineers and clinical specialists. The reason hospitals call us back is usually a person, not a product.",
    metric: { value: "120+", label: "Biomedical engineers certified" },
    ctaLabel: "Open careers",
    ctaHref: "#careers",
    image: "/lab-technician-using-analyzer-machine.jpeg",
    imageAlt: "Lab technician operating a clinical analyzer machine",
    imagePosition: "center center",
  },
];

const CARD_CLASS =
  "!bg-[color:var(--color-surface)] !border !border-[color:var(--color-border)] " +
  "!shadow-[0_24px_60px_-28px_rgba(10,31,44,0.18)] !rounded-[32px] " +
  "!p-0 !h-96 !mt-0 overflow-hidden";

export function Pillars() {
  const [stackComplete, setStackComplete] = useState(false);
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
              eyebrow="WHO WE ARE"
              title="A trustworthy ally for a healthier Bangladesh."
              lede="Operations across Bangladesh — broad, comprehensive, and constantly evolving. Four pillars guide every project we take on."
            />
            <Reveal delay={200}>
              <button
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
                Explore Services <Arrow />
              </button>
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
                <PillarCardContent {...it} total={ITEMS.length} index={idx} />
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
  metric,
  ctaLabel,
  ctaHref,
  image,
  imageAlt,
  imagePosition,
  total,
}: Pillar & { total: number; index: number }) {
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
          style={{ objectFit: "cover", objectPosition: imagePosition ?? "center" }}
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
              Pillar {n} / 0{total}
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
              {metric.value}
            </span>
            <span
              style={{
                fontSize: 12,
                color: "var(--color-text-muted)",
                lineHeight: 1.35,
                maxWidth: "22ch",
              }}
            >
              {metric.label}
            </span>
          </div>

          <span
            aria-hidden
            style={{
              width: 1,
              height: 22,
              background: "var(--color-border)",
              flexShrink: 0,
            }}
          />

          <motion.a
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
          </motion.a>
        </div>
      </div>

      <style>{`
        .pillar-cta:hover { color: var(--color-brand) !important; }
      `}</style>
    </div>
  );
}
