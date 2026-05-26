"use client";

import { useState } from "react";
import {
  Arrow,
  Container,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";

type TeamMember = {
  name: string;
  role: string;
  placeholder: string;
  tone: "teal" | "orange" | "slate";
};

const TEAM: TeamMember[] = [
  { name: "Dr. Md Jahidul Islam", role: "MD & CEO", placeholder: "CEO portrait", tone: "teal" },
  { name: "Md. Aktaruzzaman Sarker", role: "Director", placeholder: "Director portrait", tone: "slate" },
  { name: "Mostary Morshed Smriti", role: "Director · COO", placeholder: "COO portrait", tone: "orange" },
  { name: "Md. Showkot Ali", role: "Director", placeholder: "Director portrait", tone: "teal" },
  { name: "Sheikh Moha. Faizullah Shipon", role: "Director · CMO", placeholder: "CMO portrait", tone: "slate" },
];

export function Management() {
  return (
    <Section>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "end",
            marginBottom: 48,
          }}
        >
          <SectionTitle
            eyebrow="MANAGEMENT BODY"
            title="Meet the people leading SPIBER MED."
            lede="A team of clinicians, operators, and builders — combined decades of work across hospital systems, manufacturing, and medical education."
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <a
              href="#"
              style={{
                alignSelf: "end",
                justifySelf: "end",
                fontSize: 14,
                fontWeight: 500,
                color: "var(--color-brand-deep)",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              See full leadership <Arrow />
            </a>
          </Reveal>
        </div>

        <div
          className="equal-5col"
          style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}
        >
          {TEAM.map((p, i) => (
            <Reveal key={p.name} delay={i * 80}>
              <TeamCard {...p} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function TeamCard({ name, role, placeholder, tone }: TeamMember) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: "var(--color-surface)",
        height: "100%",
        border: "1px solid " + (hover ? "var(--teal-200)" : "var(--color-border)"),
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transition: "all 300ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
      }}
    >
      <div style={{ height: 240, overflow: "hidden", position: "relative" }}>
        <Placeholder
          label={placeholder}
          tone={tone}
          style={{
            width: "100%",
            height: "100%",
            transform: hover ? "scale(1.04)" : "scale(1)",
            transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, transparent 50%, rgba(10,19,24,.55))",
            opacity: hover ? 1 : 0.6,
            transition: "opacity 240ms",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            display: "flex",
            gap: 8,
            opacity: hover ? 1 : 0,
            transform: hover ? "translateY(0)" : "translateY(6px)",
            transition: "all 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          {["in", "X", "fb"].map((s) => (
            <span
              key={s}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "rgba(255,255,255,.92)",
                backdropFilter: "blur(8px)",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--color-text-strong)",
              }}
            >
              {s}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: 18 }}>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 15,
            letterSpacing: "-.005em",
            color: "var(--color-text-strong)",
            lineHeight: 1.25,
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--color-brand-deep)",
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          {role}
        </div>
      </div>
    </div>
  );
}
