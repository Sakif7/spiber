"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Arrow,
  Container,
  Placeholder,
  Reveal,
  Section,
  SectionTitle,
} from "@/components/ui";
import type { Tone } from "@/lib/content-types";

export type NewsItem = {
  slug: string;
  kicker: string;
  title: string;
  excerpt: string;
  date: string;
  readingTime: string;
  image: string | null;
  tone: Tone;
};

/** Homepage "Latest News", driven by live published blog posts. */
export function LatestNewsView({ items }: { items: NewsItem[] }) {
  const t = useTranslations("home.latestNews");

  return (
    <Section style={{ background: "var(--color-surface-2)" }}>
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
            eyebrow={t("eyebrow")}
            title={t("title")}
            lede={t("lede")}
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <Link
              href="/blog"
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
              {t("visitBlog")} <Arrow />
            </Link>
          </Reveal>
        </div>

        {items.length === 0 ? (
          <Reveal>
            <div
              style={{
                border: "1px dashed var(--color-border)",
                borderRadius: "var(--r-lg)",
                padding: "var(--s-12)",
                textAlign: "center",
                color: "var(--color-text-muted)",
                background: "var(--color-surface)",
              }}
            >
              {t("empty")}
            </div>
          </Reveal>
        ) : (
          <div
            className="equal-3col"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
            }}
          >
            {items.map((p, i) => (
              <Reveal key={p.slug} delay={i * 100}>
                <NewsCard item={p} />
              </Reveal>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const t = useTranslations("home.latestNews");
  const [hover, setHover] = useState(false);
  const kicker = item.kicker || t("kickerFallback");
  return (
    <Link
      href={`/blog/${item.slug}`}
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
          background:
            "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
          transform: hover ? "scaleX(1)" : "scaleX(0)",
          transformOrigin: "left",
          transition: "transform 420ms cubic-bezier(.16,1,.3,1)",
        }}
      />
      <div style={{ height: 200, overflow: "hidden", position: "relative" }}>
        {item.image ? (
          <Image
            src={item.image}
            alt={item.title}
            fill
            sizes="(max-width: 980px) 100vw, 33vw"
            style={{
              objectFit: "cover",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 700ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        ) : (
          <Placeholder
            label={item.title}
            tone={item.tone}
            style={{
              width: "100%",
              height: "100%",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 700ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 14,
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: ".14em",
            textTransform: "uppercase",
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
        {(item.date || item.readingTime) && (
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
            {item.date && <span>{item.date}</span>}
            {item.date && item.readingTime && <span>·</span>}
            {item.readingTime && <span>{item.readingTime}</span>}
          </div>
        )}
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
          {item.title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text-muted)",
            flex: 1,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.excerpt}
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
          {t("readMore")} <Arrow size={12} />
        </div>
      </div>
    </Link>
  );
}
