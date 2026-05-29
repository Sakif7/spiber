"use client";

import { CSSProperties, useState } from "react";
import {
  Arrow,
  Container,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";

type Segment = {
  tone: "teal" | "orange" | "slate";
  kicker: string;
  title: string;
  body: string;
  tag?: string;
  placeholder: string;
  big?: boolean;
};

const SEGMENTS: Segment[] = [
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

export function BusinessSegments() {
  return (
    <Section dots style={{ background: "var(--color-surface-2)" }}>
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
            <SegmentCard {...SEGMENTS[0]} />
          </Reveal>
          <Reveal delay={80}>
            <SegmentCard {...SEGMENTS[1]} />
          </Reveal>
          <Reveal delay={160}>
            <SegmentCard {...SEGMENTS[2]} />
          </Reveal>
          <Reveal delay={240}>
            <SegmentCard {...SEGMENTS[3]} />
          </Reveal>
          <Reveal delay={320}>
            <SegmentCard {...SEGMENTS[4]} />
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
        border: "1px solid " + (hover ? "var(--teal-300)" : "var(--teal-100)"),
        display: "flex",
        flexDirection: "column",
        boxShadow: hover ? "var(--shadow-brand)" : "var(--shadow-xs)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 320ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
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
          background: "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
          transform: hover ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transition: "transform 420ms cubic-bezier(.16,1,.3,1)",
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
