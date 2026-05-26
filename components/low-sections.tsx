"use client";

import { useState } from "react";
import {
  Arrow,
  Container,
  Eyebrow,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
  useCountUp,
} from "./primitives";

/* ============================================================
   CAPITAL EQUIPMENT — filterable grid
   ============================================================ */
type Item = {
  name: string;
  cat: string;
  sku: string;
  tag?: string;
  tone: "teal" | "orange" | "slate";
  placeholder: string;
};

export function CapitalEquipment() {
  const categories = [
    "All",
    "Hospital-Wide",
    "Patient Care",
    "Critical Care",
    "OR Solutions",
    "Surgical",
    "Lab Diagnostics",
    "Imaging",
    "Disposables",
    "Ventilators",
  ];
  const [active, setActive] = useState("All");

  const items: Item[] = [
    { name: "Mobile C-Arm SXR-200", cat: "Imaging", sku: "042-C2", tag: "FEATURED", tone: "teal", placeholder: "C-arm product shot" },
    { name: "ICU Ventilator V8", cat: "Ventilators", sku: "311-VT", tag: "NEW 2026", tone: "orange", placeholder: "ventilator render" },
    { name: "Multi-para Monitor M12", cat: "Patient Care", sku: "118-PC", tone: "teal", placeholder: "monitor screen" },
    { name: "Operating Table Pro X", cat: "OR Solutions", sku: "204-OR", tone: "slate", placeholder: "operating table" },
    { name: "Hematology Analyzer H7", cat: "Lab Diagnostics", sku: "501-LD", tone: "teal", placeholder: "lab analyzer" },
    { name: "Anesthesia Workstation A6", cat: "OR Solutions", sku: "207-OR", tone: "orange", placeholder: "anesthesia unit" },
    { name: "Surgical Light Ω-LED", cat: "OR Solutions", sku: "212-OR", tone: "slate", placeholder: "surgical light" },
    { name: "Ultrasound iScan-9", cat: "Imaging", sku: "045-IM", tag: "CE", tone: "teal", placeholder: "ultrasound probe" },
    { name: "ICU Bed E-3", cat: "Hospital-Wide", sku: "601-FU", tone: "orange", placeholder: "ICU bed" },
    { name: "Disposable PPE Kit", cat: "Disposables", sku: "810-DS", tone: "slate", placeholder: "PPE pack" },
    { name: "ECG Cardio-12L", cat: "Patient Care", sku: "124-PC", tone: "teal", placeholder: "ECG device" },
    { name: "Electrosurgical Unit ESU-2K", cat: "Surgical", sku: "230-SR", tone: "orange", placeholder: "ESU device" },
  ];

  const filtered = active === "All" ? items : items.filter((i) => i.cat === active);

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 48,
            alignItems: "end",
            marginBottom: 36,
          }}
        >
          <SectionTitle
            eyebrow="OUR CAPITAL EQUIPMENT"
            title="The full catalog, browseable in one place."
            lede="Filter by clinical category or department. Every listing carries a model, SKU, certification status, and lead-time estimate."
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <a
                href="#"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-brand-deep)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                }}
              >
                Download full catalog (PDF · 4.2 MB) <Arrow />
              </a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 28,
              padding: 6,
              background: "var(--color-surface)",
              borderRadius: 999,
              border: "1px solid var(--color-border)",
              width: "fit-content",
              maxWidth: "100%",
            }}
          >
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                style={{
                  background: active === c ? "var(--color-brand)" : "transparent",
                  color: active === c ? "white" : "var(--color-text)",
                  border: "none",
                  borderRadius: 999,
                  padding: "9px 16px",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 240ms cubic-bezier(.16,1,.3,1)",
                  boxShadow: active === c ? "var(--shadow-brand)" : "none",
                  whiteSpace: "nowrap",
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </Reveal>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 18,
          }}
        >
          {filtered.map((it, i) => (
            <Reveal key={it.sku} delay={Math.min(i * 50, 400)}>
              <EquipmentCard {...it} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function EquipmentCard({ name, cat, sku, tag, tone, placeholder }: Item) {
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
        boxShadow: hover ? "var(--shadow-md)" : "var(--shadow-xs)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
      }}
    >
      <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
        <Placeholder
          label={placeholder}
          tone={tone}
          style={{
            width: "100%",
            height: "100%",
            transform: hover ? "scale(1.06)" : "scale(1)",
            transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
          }}
        />
        {tag && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background:
                tag === "FEATURED" ? "var(--color-secondary)" : "var(--color-brand)",
              color: "white",
              fontSize: 10,
              fontWeight: 600,
              padding: "4px 9px",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              letterSpacing: ".1em",
            }}
          >
            {tag}
          </span>
        )}
      </div>
      <div
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          flex: 1,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: ".1em",
            color: "var(--color-text-muted)",
          }}
        >
          {cat.toUpperCase()}
        </div>
        <div
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 16,
            fontWeight: 600,
            color: "var(--color-text-strong)",
            letterSpacing: "-.01em",
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
            paddingTop: 12,
            borderTop: "1px solid var(--color-hairline)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-muted)",
            }}
          >
            SKU · {sku}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: hover ? "var(--color-brand-deep)" : "var(--color-text-muted)",
            }}
          >
            View →
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   CSR BAND
   ============================================================ */
export function CSRBand() {
  const pillars = [
    {
      icon: "M12 21s-7-4.5-7-11a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 6.5-7 11-7 11Z",
      title: "Devoted to communities",
      body: "Useful products and solutions delivered to communities that need them most.",
    },
    {
      icon: "M4 12a8 8 0 0 1 16 0M4 12h16M4 12a8 8 0 0 0 16 0",
      title: "Promoting public health",
      body: "Vigorous support for programs that broaden access to healthcare.",
    },
    {
      icon: "M3 13l4-4 4 4 4-6 4 6",
      title: "Dispersing technology",
      body: "Continued innovation that brings advanced tech to every corner of the country.",
    },
    {
      icon: "M5 19v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2 M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
      title: "Fostering medical talents",
      body: "A knowledge-sharing platform that helps clinicians grow and connect.",
    },
  ];

  return (
    <Section dark mesh>
      <Container>
        <div
          className="equal-2col"
          style={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1fr",
            gap: 64,
            alignItems: "center",
            marginBottom: 56,
          }}
        >
          <SectionTitle
            dark
            eyebrow="CORPORATE SOCIAL RESPONSIBILITY"
            title="Accessible healthcare at every corner of Bangladesh."
            lede="SPIBER aspires to enhance healthcare for all. Our work to be an outstanding corporate citizen grows alongside our philosophy."
          />
          <Reveal delay={200}>
            <blockquote
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                fontSize: 22,
                lineHeight: 1.45,
                color: "rgba(255,255,255,.88)",
                letterSpacing: "-.005em",
                borderLeft: "2px solid var(--orange-400)",
                paddingLeft: 24,
                fontStyle: "italic",
                fontWeight: 400,
              }}
            >
              &ldquo;We endeavor to be an outstanding corporate citizen — growing every year with the same philosophy that started us.&rdquo;
              <footer
                style={{
                  marginTop: 14,
                  fontStyle: "normal",
                  fontSize: 12,
                  fontFamily: "var(--font-mono)",
                  color: "rgba(255,255,255,.55)",
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                }}
              >
                — FROM OUR CORPORATE PHILOSOPHY
              </footer>
            </blockquote>
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
          {pillars.map((p, i) => (
            <Reveal key={p.title} delay={i * 80}>
              <div
                style={{
                  padding: 24,
                  height: "100%",
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid rgba(255,255,255,.1)",
                  backdropFilter: "blur(8px)",
                  borderRadius: "var(--r-lg)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                  minHeight: 240,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: "rgba(20,179,152,.18)",
                    color: "var(--teal-300)",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path
                      d={p.icon}
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontFamily: "var(--font-display)",
                    fontWeight: 600,
                    fontSize: 18,
                    letterSpacing: "-.01em",
                    lineHeight: 1.25,
                    color: "white",
                  }}
                >
                  {p.title}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: "rgba(255,255,255,.7)",
                    flex: 1,
                  }}
                >
                  {p.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/* ============================================================
   STATS BAND — animated counters
   ============================================================ */
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
