"use client";

import { useEffect, useState } from "react";
import {
  Arrow,
  Container,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";
import type { Post } from "@/lib/content-types";

const FALLBACK: Post[] = [
  {
    kicker: "INDUSTRY",
    title: "Healthcare industry management — the operator's lens",
    excerpt:
      "A long-form look at how Bangladesh's hospital operators are modernizing — and the structural reforms that need to follow.",
    date: "25 NOV 2025",
    read: "8 min",
    tone: "teal",
    placeholder: "industry feature photo",
  },
  {
    kicker: "WORKFORCE",
    title: "Global employability for healthcare professionals",
    excerpt:
      "How our overseas placement pathways are connecting Bangladeshi clinicians with hospitals in Japan, Germany, and the UK.",
    date: "18 NOV 2025",
    read: "6 min",
    tone: "orange",
    placeholder: "workforce photo",
  },
  {
    kicker: "FIELD NOTES",
    title: "Lessons from the COVID-19 response, five years on",
    excerpt:
      "What worked, what didn't, and what every hospital can carry forward into the next public-health emergency.",
    date: "01 NOV 2025",
    read: "10 min",
    tone: "slate",
    placeholder: "field photo",
  },
];

export function LatestNews({ initial }: { initial?: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(
    initial && initial.length ? initial : FALLBACK
  );

  useEffect(() => {
    if (initial && initial.length) return;
    let cancelled = false;
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: { posts?: Post[] }) => {
        if (cancelled) return;
        if (data.posts && data.posts.length) setPosts(data.posts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial]);

  return (
    <Section dots style={{ background: "var(--color-surface-2)" }}>
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
            eyebrow="LATEST NEWS"
            title="Field notes from the front of healthcare."
            lede="Stories, analysis, and dispatches from our team and partners."
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
              Visit the blog <Arrow />
            </a>
          </Reveal>
        </div>

        <div
          className="equal-3col"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}
        >
          {posts.map((p, i) => (
            <Reveal key={p.title} delay={i * 100}>
              <NewsCard {...p} />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function NewsCard({ kicker, title, excerpt, date, read, tone, placeholder }: Post) {
  const [hover, setHover] = useState(false);
  return (
    <article
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        height: "100%",
        border: "1px solid " + (hover ? "var(--teal-300)" : "var(--teal-100)"),
        borderRadius: "var(--r-xl)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover ? "var(--shadow-brand)" : "var(--shadow-xs)",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
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
      <div style={{ height: 200, overflow: "hidden", position: "relative" }}>
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
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: ".14em",
            color: "var(--color-text-strong)",
            background: "rgba(255,255,255,.92)",
            backdropFilter: "blur(8px)",
            padding: "5px 9px",
            borderRadius: 4,
          }}
        >
          {kicker}
        </div>
      </div>
      <div
        style={{
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          flex: 1,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-text-muted)",
            letterSpacing: ".06em",
          }}
        >
          <span>{date}</span>
          <span>·</span>
          <span>{read} read</span>
        </div>
        <h3
          style={{
            margin: 0,
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: 20,
            lineHeight: 1.25,
            letterSpacing: "-.015em",
            color: "var(--color-text-strong)",
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text-muted)",
            flex: 1,
          }}
        >
          {excerpt}
        </p>
        <div
          style={{
            marginTop: 4,
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
    </article>
  );
}
