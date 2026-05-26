"use client";

import { CSSProperties, ReactNode, useState } from "react";
import {
  Arrow,
  Container,
  Eyebrow,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
} from "./primitives";

/* ============================================================
   PILLARS — A Trustworthy Ally
   ============================================================ */
export function Pillars() {
  const items = [
    {
      n: "01",
      title: "Business Goals",
      body: "Collaborating with Bangladesh's top hospitals as a trusted long-term partner.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </svg>
      ),
    },
    {
      n: "02",
      title: "Products & Solutions",
      body: "Cutting-edge clinical solutions that increase accuracy and operational efficiency.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 9v6 M12 9v6 M16 9v6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
    {
      n: "03",
      title: "Social Responsibility",
      body: "A knowledge-sharing platform that helps medical professionals grow and share.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.5-7 11-7 11Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      n: "04",
      title: "Employee Development",
      body: "Empowering local talent to deepen expertise and build international careers.",
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M5 19v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
    },
  ];

  return (
    <Section>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 56,
            alignItems: "end",
            marginBottom: 48,
          }}
        >
          <SectionTitle
            eyebrow="WHO WE ARE"
            title="A trustworthy ally for a healthier Bangladesh."
            lede="Operations across Bangladesh — broad, comprehensive, and constantly evolving. Four pillars guide every project we take on."
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 14 }}>
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
                }}
              >
                Explore Services <Arrow />
              </button>
            </div>
          </Reveal>
        </div>

        <div
          className="equal-4col"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 18,
          }}
        >
          {items.map((it, i) => (
            <Reveal key={it.n} delay={i * 90}>
              <PillarCard {...it} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function PillarCard({
  n,
  title,
  body,
  icon,
}: {
  n: string;
  title: string;
  body: string;
  icon: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        height: "100%",
        background: hover
          ? "linear-gradient(180deg, var(--teal-50), var(--color-surface))"
          : "var(--color-surface)",
        border: "1px solid " + (hover ? "var(--teal-200)" : "var(--color-border)"),
        borderRadius: "var(--r-xl)",
        padding: 28,
        minHeight: 280,
        display: "flex",
        flexDirection: "column",
        transform: hover ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hover ? "var(--shadow-lg)" : "var(--shadow-xs)",
        transition: "all 320ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          right: 24,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 500,
          color: hover ? "var(--color-brand)" : "var(--color-text-muted)",
          letterSpacing: ".14em",
        }}
      >
        {n}
      </div>

      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: hover ? "var(--color-brand)" : "var(--teal-50)",
          color: hover ? "white" : "var(--color-brand-deep)",
          display: "grid",
          placeItems: "center",
          marginBottom: 28,
          transition: "all 320ms cubic-bezier(.16,1,.3,1)",
          boxShadow: hover ? "var(--shadow-brand)" : "none",
        }}
      >
        {icon}
      </div>

      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 22,
          letterSpacing: "-.01em",
          lineHeight: 1.2,
          color: "var(--color-text-strong)",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          lineHeight: 1.55,
          color: "var(--color-text-muted)",
          flex: 1,
        }}
      >
        {body}
      </p>

      <div
        style={{
          marginTop: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: hover ? "var(--color-brand-deep)" : "var(--color-text-muted)",
          transform: hover ? "translateX(2px)" : "translateX(0)",
          transition: "all 280ms cubic-bezier(.16,1,.3,1)",
        }}
      >
        Learn more <Arrow size={12} />
      </div>
    </div>
  );
}

/* ============================================================
   BUSINESS SEGMENTS
   ============================================================ */
type Segment = {
  tone: "teal" | "orange" | "slate";
  kicker: string;
  title: string;
  body: string;
  tag?: string;
  placeholder: string;
  big?: boolean;
};

export function BusinessSegments() {
  const segments: Segment[] = [
    {
      tone: "teal",
      kicker: "01 · Medical Device & Solution",
      title: "Envisioning the future, with smart healthcare.",
      body: "From bedside monitors to operating theatres, our solutions are evidence-driven and clinician-approved.",
      tag: "FLAGSHIP",
      placeholder: "hospital interior photo",
      big: true,
    },
    {
      tone: "orange",
      kicker: "02 · Furniture & Disposables",
      title: "Hospital medical furniture & disposable devices.",
      body: "Beds, trolleys, OT tables, gloves, masks, gowns, drapes — sourced to international standards.",
      placeholder: "furniture catalog shot",
    },
    {
      tone: "slate",
      kicker: "03 · Patient & Critical Care",
      title: "Patient care & critical care.",
      body: "Monitoring, infusion, ICU/NICU/CCU equipment. Reliable when minutes count.",
      placeholder: "ICU bay shot",
    },
    {
      tone: "teal",
      kicker: "04 · OR & Surgical",
      title: "OR & surgical solutions.",
      body: "Operating tables, surgical lights, anesthesia, ESU, minimally invasive sets, orthopedic implants.",
      placeholder: "OR scene",
    },
    {
      tone: "orange",
      kicker: "05 · Imaging & Lab Diagnostics",
      title: "Medical imaging & laboratory diagnostics.",
      body: "Ultrasound, X-ray, C-arm, CT, MRI, mammography — plus hematology, chemistry, immunoassay & reagents.",
      placeholder: "imaging suite",
    },
  ];

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div style={{ marginBottom: 56 }}>
          <SectionTitle
            eyebrow="OUR BUSINESS SEGMENTS"
            title="Five categories. One coherent system."
            lede="Built so a hospital can source everything from procurement through training under one accountable partner."
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
            <SegmentCard {...segments[0]} />
          </Reveal>
          <Reveal delay={80}>
            <SegmentCard {...segments[1]} />
          </Reveal>
          <Reveal delay={160}>
            <SegmentCard {...segments[2]} />
          </Reveal>
          <Reveal delay={240}>
            <SegmentCard {...segments[3]} />
          </Reveal>
          <Reveal delay={320}>
            <SegmentCard {...segments[4]} />
          </Reveal>
        </div>
      </Container>
    </Section>
  );
}

function SegmentCard({ tone, kicker, title, body, tag, placeholder, big }: Segment) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        height: "100%",
        minHeight: big ? 520 : 250,
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        display: "flex",
        flexDirection: "column",
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 320ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
      }}
    >
      <div
        style={{
          position: "relative",
          flex: 1,
          minHeight: big ? 360 : 150,
          overflow: "hidden",
        }}
      >
        <Placeholder
          label={placeholder}
          tone={tone}
          style={{
            width: "100%",
            height: "100%",
            transform: hover ? "scale(1.06)" : "scale(1)",
            transition: "transform 700ms cubic-bezier(.16,1,.3,1)",
          }}
        />
        {tag && (
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
            {tag}
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
            color: "var(--color-brand-deep)",
            marginBottom: 10,
          }}
        >
          {kicker}
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
          {title}
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
          {body}
        </p>

        <div
          style={{
            marginTop: big ? 22 : 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 500,
            color: "var(--color-brand-deep)",
            transform: hover ? "translateX(2px)" : "translateX(0)",
            transition: "transform 280ms cubic-bezier(.16,1,.3,1)",
          }}
        >
          Read more <Arrow size={12} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SKILL DEVELOPMENT — tabs
   ============================================================ */
export function SkillDevelopment() {
  const [tab, setTab] = useState(0);
  const tabs = [
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

  const active = tabs[tab];

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
              {tabs.map((t, i) => (
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
