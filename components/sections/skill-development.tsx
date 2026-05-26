"use client";

import { useState } from "react";
import {
  Arrow,
  Container,
  Eyebrow,
  Placeholder,
  Section,
  SectionTitle,
} from "@/components/ui";

const TABS = [
  {
    name: "Doctors",
    duration: "12–24 months",
    seats: "120 seats / year",
    placeholder: "doctor training photo",
    bullets: [
      "Post-graduate clinical exposure with hospital partners",
      "International placement pathway (Japan, Germany, UK)",
      "Specialty rotations: critical care, surgery, radiology",
      "Capstone research with academic mentor",
    ],
    heading: "Advancing physician practice, locally and abroad.",
  },
  {
    name: "Registered Nurses",
    duration: "9–18 months",
    seats: "300 seats / year",
    placeholder: "nursing training photo",
    bullets: [
      "Bedside competency framework, OSCE-style",
      "ICU & emergency simulation lab access",
      "English-language clinical communication track",
      "Overseas employment placement support",
    ],
    heading: "Career-grade nursing, global opportunity.",
  },
  {
    name: "Caregivers & Technicians",
    duration: "6–12 months",
    seats: "480 seats / year",
    placeholder: "technician training",
    bullets: [
      "Hands-on biomedical equipment training",
      "Geriatric & home-care specialization",
      "Industry-recognized certifications",
      "Job-placement guarantee through partner network",
    ],
    heading: "Hands-on careers in healthcare technology.",
  },
];

export function SkillDevelopment() {
  const [tab, setTab] = useState(0);
  const active = TABS[tab];

  return (
    <Section>
      <Container>
        <div style={{ marginBottom: 56 }}>
          <SectionTitle
            eyebrow="SKILL DEVELOPMENT & TRAINING"
            title="A center of excellence for professional skills."
            lede='Through "SPINE — Future Skills Bangladesh," we are accelerating the creation of a Skilled Bangladesh — accredited programmes for clinicians and health technicians.'
          />
        </div>

        <div
          className="equal-2col"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-2xl)",
            overflow: "hidden",
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
          }}
        >
          <div
            style={{
              padding: 40,
              display: "flex",
              flexDirection: "column",
              gap: 24,
            }}
          >
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TABS.map((t, i) => (
                <button
                  key={t.name}
                  onClick={() => setTab(i)}
                  style={{
                    background:
                      i === tab ? "var(--color-brand)" : "var(--color-surface-2)",
                    color: i === tab ? "white" : "var(--color-text)",
                    border: "none",
                    borderRadius: 999,
                    padding: "10px 18px",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: i === tab ? "var(--shadow-brand)" : "none",
                    transition: "all 280ms cubic-bezier(.16,1,.3,1)",
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>

            <div
              key={tab}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
                animation: "fadeIn 400ms cubic-bezier(.16,1,.3,1)",
              }}
            >
              <div>
                <Eyebrow>PROGRAMME · {active.name.toUpperCase()}</Eyebrow>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 32,
                    letterSpacing: "-.015em",
                    lineHeight: 1.1,
                    color: "var(--color-text-strong)",
                    margin: "12px 0 0",
                    maxWidth: "20ch",
                  }}
                >
                  {active.heading}
                </h3>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto 1fr",
                  gap: 12,
                  fontSize: 13,
                  alignItems: "baseline",
                }}
              >
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                  DURATION
                </div>
                <div style={{ fontWeight: 500, color: "var(--color-text-strong)" }}>
                  {active.duration}
                </div>
                <div style={{ fontFamily: "var(--font-mono)", color: "var(--color-text-muted)" }}>
                  COHORT
                </div>
                <div style={{ fontWeight: 500, color: "var(--color-text-strong)" }}>
                  {active.seats}
                </div>
              </div>

              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {active.bullets.map((b) => (
                  <li
                    key={b}
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--color-text)",
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        marginTop: 8,
                        width: 6,
                        height: 6,
                        borderRadius: 999,
                        background: "var(--color-secondary)",
                      }}
                    />
                    {b}
                  </li>
                ))}
              </ul>

              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button
                  style={{
                    background: "var(--color-brand)",
                    color: "white",
                    border: "none",
                    borderRadius: 999,
                    padding: "12px 22px",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    boxShadow: "var(--shadow-brand)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  Apply now <Arrow />
                </button>
                <button
                  style={{
                    background: "transparent",
                    color: "var(--color-text-strong)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 999,
                    padding: "12px 22px",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Curriculum PDF
                </button>
              </div>
            </div>
          </div>

          <div
            style={{ position: "relative", minHeight: 520, overflow: "hidden" }}
            key={"img" + tab}
          >
            <Placeholder
              label={active.placeholder}
              tone="teal"
              style={{
                width: "100%",
                height: "100%",
                animation: "fadeZoom 700ms cubic-bezier(.16,1,.3,1)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: 24,
                left: 24,
                right: 24,
                background: "rgba(255,255,255,.86)",
                backdropFilter: "blur(12px)",
                border: "1px solid rgba(255,255,255,.6)",
                borderRadius: "var(--r-lg)",
                padding: 18,
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-brand-deep)",
                    letterSpacing: ".14em",
                  }}
                >
                  ACCREDITED BY
                </div>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--color-text-strong)",
                    marginTop: 4,
                  }}
                >
                  Bangladesh Skill Development Authority · TVET
                </div>
              </div>
              <Arrow size={20} />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
