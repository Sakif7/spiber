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

export type CatalogItem = {
  name: string;
  slug: string;
  image: string | null;
  sku: string;
  catLabel: string;
  topSlug: string;
  tone: "teal" | "orange" | "slate";
  featured: boolean;
};
export type TopCat = { slug: string; name: string };

/** Homepage equipment showcase, driven by live Instruments products. */
export function CapitalEquipmentView({
  items,
  tops,
}: {
  items: CatalogItem[];
  tops: TopCat[];
}) {
  const t = useTranslations("home.capitalEquipment");
  const [active, setActive] = useState("all");

  const filtered =
    active === "all" ? items : items.filter((i) => i.topSlug === active);

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
            eyebrow={t("eyebrow")}
            title={t("title")}
            lede={t("lede")}
          />
          <Reveal delay={200} style={{ alignSelf: "end" }}>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}
            >
              <Link
                href="/instruments"
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
                {t("downloadCatalog")} <Arrow />
              </Link>
            </div>
          </Reveal>
        </div>

        {items.length > 0 && tops.length > 0 && (
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
              {[{ slug: "all", name: t("categories.All") }, ...tops].map(
                (c) => (
                  <button
                    key={c.slug}
                    onClick={() => setActive(c.slug)}
                    style={{
                      background:
                        active === c.slug
                          ? "var(--color-brand)"
                          : "transparent",
                      color: active === c.slug ? "white" : "var(--color-text)",
                      border: "none",
                      borderRadius: 999,
                      padding: "9px 16px",
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 240ms cubic-bezier(.16,1,.3,1)",
                      boxShadow:
                        active === c.slug ? "var(--shadow-brand)" : "none",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.name}
                  </button>
                ),
              )}
            </div>
          </Reveal>
        )}

        {filtered.length === 0 ? (
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
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 18,
            }}
          >
            {filtered.map((it, i) => (
              <Reveal key={it.sku} delay={Math.min(i * 50, 400)}>
                <EquipmentCard
                  item={it}
                  viewLabel={t("view")}
                  skuLabel={t("skuLabel")}
                  featuredLabel={t("featured")}
                />
              </Reveal>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}

function EquipmentCard({
  item,
  viewLabel,
  skuLabel,
  featuredLabel,
}: {
  item: CatalogItem;
  viewLabel: string;
  skuLabel: string;
  featuredLabel: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href={`/instruments/product/${item.slug}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        background: "var(--color-surface)",
        height: "100%",
        border: "1px solid " + (hover ? "var(--teal-300)" : "var(--teal-100)"),
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: hover ? "var(--shadow-brand)" : "var(--shadow-xs)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
        transition: "all 280ms cubic-bezier(.16,1,.3,1)",
        cursor: "pointer",
        textDecoration: "none",
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
      <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
        {item.image ? (
          <Image
            src={item.image}
            alt={item.name}
            fill
            sizes="(max-width: 768px) 100vw, 300px"
            style={{
              objectFit: "cover",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        ) : (
          <Placeholder
            label={item.catLabel || "Instrument"}
            tone={item.tone}
            style={{
              width: "100%",
              height: "100%",
              transform: hover ? "scale(1.06)" : "scale(1)",
              transition: "transform 600ms cubic-bezier(.16,1,.3,1)",
            }}
          />
        )}
        {item.featured && (
          <span
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              background: "var(--color-secondary)",
              color: "white",
              fontSize: 10,
              fontWeight: 600,
              padding: "4px 9px",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              letterSpacing: ".1em",
            }}
          >
            {featuredLabel}
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
          {item.catLabel.toUpperCase()}
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
          {item.name}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 8,
            paddingTop: 12,
            borderTop: "1px solid var(--teal-100)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-text-muted)",
            }}
          >
            {skuLabel} · {item.sku}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: hover
                ? "var(--color-brand-deep)"
                : "var(--color-text-muted)",
            }}
          >
            {viewLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
