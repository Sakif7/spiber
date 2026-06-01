"use client";

import { CSSProperties, useState } from "react";
import { useTranslations } from "next-intl";
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

const SEGMENT_META: { tone: "teal" | "orange" | "slate"; big?: boolean }[] = [
  { tone: "teal", big: true },
  { tone: "orange" },
  { tone: "slate" },
  { tone: "teal" },
  { tone: "orange" },
];

export function BusinessSegments() {
  const t = useTranslations("home.businessSegments");
  const items = t.raw("items") as Array<{
    kicker: string;
    title: string;
    body: string;
    tag?: string;
    placeholder: string;
  }>;
  const segments: Segment[] = items.map((item, i) => ({
    ...item,
    tone: SEGMENT_META[i].tone,
    big: SEGMENT_META[i].big,
  }));

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
      <Container>
        <div style={{ marginBottom: 56 }}>
          <SectionTitle
            eyebrow={t("eyebrow")}
            title={t("title")}
            lede={t("lede")}
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

function SegmentCard({
  tone,
  kicker,
  title,
  body,
  tag,
  placeholder,
  big,
}: Segment) {
  const t = useTranslations("home.businessSegments");
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
          background:
            "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
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
          {t("readMore")} <Arrow size={12} />
        </div>
      </div>
    </div>
  );
}
