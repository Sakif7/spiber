"use client";

import { CSSProperties, useEffect, useState } from "react";
import { Arrow, Container, Reveal, useMagnetic } from "./primitives";

const HERO_TAGLINES = [
  { title: "Empowering Healthcare", line: "SPIBER strives to empower healthcare and restore healthcare." },
  { title: "Transforming Healthcare", line: "Committed to providing cutting-edge technology within reach." },
  { title: "Cutting-Edge, Right at Your Door", line: "Assuring innovation across the healthcare industry." },
  { title: "Uncompromised Medical Care", line: "Quality products for end-stage of medical care." },
  { title: "Advancing Academic & Technical Skills", line: "Dazzling professionals with an advanced training system." },
  { title: "We Reach, Where Others Can't", line: "Delivering goods to any location quickly and with ease." },
];

const HERO_PARTNERS = [
  "Mindray", "GE Healthcare", "Philips", "Siemens", "Drager", "Masimo",
  "Edwards", "Stryker", "Olympus", "Karl Storz", "B. Braun", "Fujifilm",
];

function TaglineRotator({ items }: { items: typeof HERO_TAGLINES }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 4200);
    return () => clearInterval(t);
  }, [items.length]);

  return (
    <div style={{ position: "relative" }}>
      {/* indicator: 01 / 06 — sliding sub-title */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 22,
          height: 22,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--brand-teal)",
            fontSize: 11,
            letterSpacing: ".14em",
          }}
        >
          0{idx + 1} / 0{items.length}
        </span>
        <span style={{ width: 24, height: 1, background: "var(--brand-teal)" }} />
        <div style={{ position: "relative", flex: 1, height: 22, overflow: "hidden" }}>
          {items.map((t, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                color: "var(--color-text-muted)",
                transform: `translateY(${(i - idx) * 100}%)`,
                transition: "transform .7s cubic-bezier(.4,0,0,1)",
              }}
            >
              {t.title}
            </div>
          ))}
        </div>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(40px, 6.4vw, 92px)",
          fontWeight: 500,
          lineHeight: 0.98,
          letterSpacing: "-0.035em",
          margin: "0 0 8px",
          textWrap: "balance" as CSSProperties["textWrap"],
          color: "var(--color-text-strong)",
        }}
      >
        <span style={{ display: "inline-block" }}>Empowering </span>
        <span
          style={{
            position: "relative",
            display: "inline-block",
            verticalAlign: "baseline",
          }}
        >
          <span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              position: "relative",
              minWidth: 280,
            }}
          >
            {items.map((t, i) => {
              const word = t.title.split(" ").slice(-1)[0];
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    fontStyle: "italic",
                    fontFamily: 'var(--font-serif)',
                    fontWeight: 400,
                    color: "var(--brand-teal)",
                    transform: `translateY(${(i - idx) * 110}%)`,
                    opacity: i === idx ? 1 : 0,
                    transition:
                      "transform .8s cubic-bezier(.4,0,0,1), opacity .5s",
                    position: i === idx ? "static" : "absolute",
                    left: 0,
                    top: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  {word}.
                </span>
              );
            })}
          </span>
        </span>
        <br />
        <span>Built for Bangladesh.</span>
      </h1>

      <div
        style={{
          height: 60,
          marginTop: 18,
          position: "relative",
          overflow: "hidden",
          maxWidth: 540,
        }}
      >
        {items.map((t, i) => (
          <p
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              margin: 0,
              fontSize: "clamp(16px, 1.4vw, 20px)",
              lineHeight: 1.55,
              color: "var(--color-text-muted)",
              transform: `translateY(${(i - idx) * 110}%)`,
              transition: "transform .7s cubic-bezier(.4,0,0,1)",
            }}
          >
            {t.line}
          </p>
        ))}
      </div>
    </div>
  );
}

function MeshBg() {
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
      <div
        className="hero-blob"
        style={{
          width: 540,
          height: 540,
          top: -120,
          left: -120,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand-teal) 30%, transparent), transparent 70%)",
        }}
      />
      <div
        className="hero-blob"
        style={{
          width: 460,
          height: 460,
          top: 80,
          right: -80,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand-orange) 22%, transparent), transparent 70%)",
          animationDelay: "-8s",
        }}
      />
      <div
        className="hero-blob"
        style={{
          width: 380,
          height: 380,
          bottom: -100,
          left: "40%",
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand-teal) 22%, transparent), transparent 70%)",
          animationDelay: "-14s",
        }}
      />
      <svg
        width="100%"
        height="100%"
        style={{ position: "absolute", inset: 0, opacity: 0.35 }}
      >
        <defs>
          <pattern id="hero-grid" width="72" height="72" patternUnits="userSpaceOnUse">
            <path
              d="M 72 0 L 0 0 0 72"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
    </div>
  );
}

function HeroScene() {
  const monoTiny: CSSProperties = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    color: "var(--color-text-muted)",
  };
  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1/1.05",
        borderRadius: 28,
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        background:
          "linear-gradient(160deg, var(--color-surface) 0%, var(--color-surface-2) 100%)",
      }}
    >
      <div style={{ position: "absolute", top: 16, left: 16, ...monoTiny }}>
        SCENE_01 · OR.HYBRID
      </div>
      <div style={{ position: "absolute", top: 16, right: 16, ...monoTiny }}>↻ LIVE</div>
      <div style={{ position: "absolute", bottom: 16, left: 16, ...monoTiny }}>
        TODO: PRODUCT SHOT
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 16,
          right: 16,
          ...monoTiny,
          color: "var(--brand-teal)",
        }}
      >
        ● 60fps
      </div>

      <svg
        viewBox="0 0 400 400"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <linearGradient id="pulseGrad" x1="0" x2="1">
            <stop offset="0" stopColor="var(--brand-teal)" stopOpacity="0" />
            <stop offset=".4" stopColor="var(--brand-teal)" stopOpacity=".4" />
            <stop offset="1" stopColor="var(--brand-teal)" stopOpacity="1" />
          </linearGradient>
        </defs>
        {[60, 110, 160, 210].map((r, i) => (
          <circle
            key={i}
            cx="200"
            cy="220"
            r={r}
            fill="none"
            stroke="var(--slate-300)"
            strokeWidth=".75"
            strokeDasharray={i % 2 ? "3 5" : "0"}
            opacity=".55"
          />
        ))}
        <path
          d="M 20 220 L 110 220 L 130 220 L 145 220 L 160 150 L 180 290 L 200 220 L 270 220 L 290 200 L 310 240 L 380 220"
          fill="none"
          stroke="url(#pulseGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="800"
            to="0"
            dur="2.4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-dasharray"
            values="0 800;800 0"
            dur="2.4s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="380" cy="220" r="4" fill="var(--brand-orange)">
          <animate
            attributeName="r"
            values="3.5;5.5;3.5"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="200" cy="60" r="3" fill="var(--brand-teal)" />
        <circle cx="200" cy="380" r="3" fill="var(--brand-teal)" />
        <circle cx="60" cy="220" r="3" fill="var(--brand-teal)" />
        <circle cx="340" cy="220" r="3" fill="var(--brand-teal)" />
        <line
          x1="200"
          y1="60"
          x2="200"
          y2="100"
          stroke="var(--brand-teal)"
          strokeWidth="1"
        />
        <line
          x1="340"
          y1="220"
          x2="290"
          y2="220"
          stroke="var(--brand-teal)"
          strokeWidth="1"
        />
        <text
          x="200"
          y="48"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--color-text-muted)"
        >
          SpO₂ 98%
        </text>
        <text
          x="350"
          y="218"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--color-text-muted)"
        >
          72 bpm
        </text>
        <text
          x="50"
          y="218"
          textAnchor="end"
          fontFamily="var(--font-mono)"
          fontSize="9"
          fill="var(--color-text-muted)"
        >
          36.6°
        </text>
      </svg>

      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "8%",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 22,
          padding: "10px 12px",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          animation: "heroFloat 6s ease-in-out infinite",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--teal-50)",
            color: "var(--brand-teal)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 12h4l2-3 4 6 2-3h6" />
            <path d="M21 12a5 5 0 0 0-9-3 5 5 0 0 0-9 3c0 6 9 10 9 10s9-4 9-10z" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            VITALS
          </div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Live · 6 beds</div>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          bottom: "16%",
          left: "6%",
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: 22,
          padding: "10px 12px",
          boxShadow: "var(--shadow-md)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          animation: "heroFloat 7s ease-in-out infinite",
          animationDelay: "-2s",
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--orange-50)",
            color: "var(--brand-orange)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-muted)",
            }}
          >
            UPTIME
          </div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>99.98% · 30d</div>
        </div>
      </div>
    </div>
  );
}

function PartnerMarquee() {
  return (
    <div
      style={{
        borderTop: "1px solid var(--color-border)",
        paddingTop: 26,
        marginTop: 80,
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
  const ctaMag = useMagnetic<HTMLButtonElement>(0.22, 90);

  return (
    <section
      style={{
        position: "relative",
        overflow: "hidden",
        paddingTop: "clamp(40px, 6vw, 80px)",
        paddingBottom: "clamp(40px, 6vw, 80px)",
        background: "var(--color-surface)",
      }}
    >
      <MeshBg />
      <Container style={{ position: "relative", zIndex: 1 }}>
        <div
          className="hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
            gap: 56,
            alignItems: "center",
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <Reveal>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px 5px 10px",
                borderRadius: 999,
                background: "var(--color-surface-2)",
                border: "1px solid var(--color-border)",
                fontSize: 11.5,
                fontWeight: 500,
                color: "var(--color-text-strong)",
                marginBottom: 22,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: "var(--brand-teal)",
                  boxShadow:
                    "0 0 0 4px color-mix(in oklab, var(--brand-teal) 22%, transparent)",
                }}
              />
              Healthcare Solutions · Est. 2008 · Dhaka
            </div>

            <TaglineRotator items={HERO_TAGLINES} />

            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 36,
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <button
                ref={ctaMag}
                style={{
                  background: "var(--color-brand)",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "0 18px",
                  height: 44,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  boxShadow:
                    "0 8px 22px -8px color-mix(in oklab, var(--brand-teal) 60%, transparent)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  transition: "all .25s cubic-bezier(.2,.7,.2,1)",
                }}
              >
                Request a Quote <Arrow size={14} />
              </button>
              <button
                style={{
                  background: "transparent",
                  color: "var(--color-text-strong)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 999,
                  padding: "0 18px",
                  height: 44,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all .25s cubic-bezier(.2,.7,.2,1)",
                }}
              >
                Explore Solutions
              </button>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginLeft: 8,
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-teal)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  ISO 13485
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--brand-teal)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  24×7 biomed
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <HeroScene />
          </Reveal>
        </div>

        <Reveal>
          <PartnerMarquee />
        </Reveal>
      </Container>
    </section>
  );
}
