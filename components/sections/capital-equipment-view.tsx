"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Arrow,
  CatalogCard,
  Container,
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
                <CatalogCard
                  href={`/instruments/product/${it.slug}`}
                  image={it.image}
                  imageAlt={it.name}
                  placeholderLabel={it.catLabel || "Instrument"}
                  placeholderTone={it.tone}
                  imageTopLeft={
                    it.featured ? (
                      <span
                        style={{
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
                        {t("featured")}
                      </span>
                    ) : undefined
                  }
                  topLabel={it.catLabel}
                  title={it.name}
                  footerLeft={
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {t("skuLabel")} · {it.sku}
                    </span>
                  }
                  action={t("view")}
                />
              </Reveal>
            ))}
          </div>
        )}
      </Container>
    </Section>
  );
}
