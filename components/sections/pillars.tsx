"use client";

import { ReactNode, useState } from "react";
import Image from "next/image";
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
  title: string;
  body: string;
  icon: ReactNode;
  image: string;
  imageAlt: string;
  imagePosition?: string;
};

const ITEMS: Pillar[] = [
  {
    n: "01",
    title: "Business Goals",
    body: "Collaborating with Bangladesh's top hospitals as a trusted long-term partner.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      </svg>
    ),
    image: "/smiling-medical-team-portrait.jpeg",
    imageAlt: "Medical team standing together in a hospital corridor",
    imagePosition: "center 30%",
  },
  {
    n: "02",
    title: "Products & Solutions",
    body: "Cutting-edge clinical solutions that increase accuracy and operational efficiency.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
        <path d="M8 9v6 M12 9v6 M16 9v6" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    image: "/modern-operating-room-equipment.jpeg",
    imageAlt: "Modern operating room with surgical robotics and imaging systems",
    imagePosition: "center center",
  },
  {
    n: "03",
    title: "Social Responsibility",
    body: "A knowledge-sharing platform that helps medical professionals grow and share.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.5-7 11-7 11Z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    ),
    image: "/nurse-comforting-elderly-woman-home-care.jpeg",
    imageAlt: "Nurse comforting an elderly patient during a home visit",
    imagePosition: "center 35%",
  },
  {
    n: "04",
    title: "Employee Development",
    body: "Empowering local talent to deepen expertise and build international careers.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 19v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    ),
    image: "/manager-reviewing-work-with-employee-computer.jpeg",
    imageAlt: "Mentor reviewing work with a colleague at a computer",
    imagePosition: "center 25%",
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
            itemDistance={32}
            itemStackDistance={10}
            baseScale={0.94}
            itemScale={0.02}
            stackPosition="38%"
            scaleEndPosition="14%"
            innerClassName="pt-0 pb-[10rem]"
            onStackComplete={setStackComplete}
          >
            {ITEMS.map((it) => (
              <ScrollStackItem key={it.n} itemClassName={CARD_CLASS}>
                <PillarCardContent {...it} />
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

function PillarCardContent({ n, title, body, icon, image, imageAlt, imagePosition }: Pillar) {
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
          padding: "40px 0 40px 44px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "var(--color-brand)",
              color: "white",
              display: "grid",
              placeItems: "center",
              boxShadow: "var(--shadow-brand)",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 500,
              color: "var(--color-brand)",
              letterSpacing: ".18em",
            }}
          >
            {n} · PILLAR
          </div>
        </div>

        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 32,
            letterSpacing: "-.02em",
            lineHeight: 1.1,
            color: "var(--color-text-strong)",
            margin: 0,
            textWrap: "balance",
          }}
        >
          {title}
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: 15.5,
            lineHeight: 1.55,
            color: "var(--color-text-muted)",
            maxWidth: "42ch",
          }}
        >
          {body}
        </p>

        <div
          style={{
            marginTop: 6,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 14,
            fontWeight: 500,
            color: "var(--color-brand-deep)",
          }}
        >
          Learn more <Arrow size={13} />
        </div>
      </div>
    </div>
  );
}
