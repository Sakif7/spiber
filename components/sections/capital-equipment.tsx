"use client";

import { useState } from "react";
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

type Item = {
  name: string;
  cat: string;
  catLabel: string;
  sku: string;
  tag?: string;
  tagLabel?: string;
  tone: "teal" | "orange" | "slate";
  placeholder: string;
};

const CATEGORY_KEYS = [
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

const ITEM_META: {
  cat: string;
  sku: string;
  tag?: string;
  tone: "teal" | "orange" | "slate";
}[] = [
  { cat: "Imaging", sku: "042-C2", tag: "FEATURED", tone: "teal" },
  { cat: "Ventilators", sku: "311-VT", tag: "NEW 2026", tone: "orange" },
  { cat: "Patient Care", sku: "118-PC", tone: "teal" },
  { cat: "OR Solutions", sku: "204-OR", tone: "slate" },
  { cat: "Lab Diagnostics", sku: "501-LD", tone: "teal" },
  { cat: "OR Solutions", sku: "207-OR", tone: "orange" },
  { cat: "OR Solutions", sku: "212-OR", tone: "slate" },
  { cat: "Imaging", sku: "045-IM", tag: "CE", tone: "teal" },
  { cat: "Hospital-Wide", sku: "601-FU", tone: "orange" },
  { cat: "Disposables", sku: "810-DS", tone: "slate" },
  { cat: "Patient Care", sku: "124-PC", tone: "teal" },
  { cat: "Surgical", sku: "230-SR", tone: "orange" },
];

export function CapitalEquipment() {
  const t = useTranslations("home.capitalEquipment");
  const [active, setActive] = useState("All");

  const categoryLabels = t.raw("categories") as Record<string, string>;
  const itemContent = t.raw("items") as Array<{
    name: string;
    catLabel: string;
    tagLabel?: string;
    placeholder: string;
  }>;

  const ITEMS: Item[] = ITEM_META.map((meta, i) => ({
    name: itemContent[i].name,
    cat: meta.cat,
    catLabel: itemContent[i].catLabel,
    sku: meta.sku,
    tag: meta.tag,
    tagLabel: itemContent[i].tagLabel,
    tone: meta.tone,
    placeholder: itemContent[i].placeholder,
  }));

  const filtered =
    active === "All" ? ITEMS : ITEMS.filter((i) => i.cat === active);

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
            {CATEGORY_KEYS.map((c) => (
              <button
                key={c}
                onClick={() => setActive(c)}
                style={{
                  background:
                    active === c ? "var(--color-brand)" : "transparent",
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
                {categoryLabels[c]}
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
              <EquipmentCard
                {...it}
                viewLabel={t("view")}
                skuLabel={t("skuLabel")}
              />
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

function EquipmentCard({
  name,
  catLabel,
  sku,
  tag,
  tagLabel,
  tone,
  placeholder,
  viewLabel,
  skuLabel,
}: Item & { viewLabel: string; skuLabel: string }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      href="/instruments"
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
                tag === "FEATURED"
                  ? "var(--color-secondary)"
                  : "var(--color-brand)",
              color: "white",
              fontSize: 10,
              fontWeight: 600,
              padding: "4px 9px",
              borderRadius: 999,
              fontFamily: "var(--font-mono)",
              letterSpacing: ".1em",
            }}
          >
            {tagLabel}
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
          {catLabel.toUpperCase()}
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
            {skuLabel} · {sku}
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
