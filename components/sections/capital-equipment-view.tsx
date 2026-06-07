"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Arrow,
  CatalogCard,
  Container,
  CtaButton,
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

/** How many products the teaser shows per active filter. */
const DISPLAY = 8;

/**
 * Homepage equipment teaser, driven by live Instruments products. Keeps the
 * clinical-category filter pills the client likes, but fits them to a single
 * line — overflowing categories collapse into an "and more" pill that links to
 * the full Instruments catalog. The grid shows a small slice; "see more" sends
 * visitors to the full catalog rather than listing every product here.
 */
export function CapitalEquipmentView({
  items,
  tops,
}: {
  items: CatalogItem[];
  tops: TopCat[];
}) {
  const t = useTranslations("home.capitalEquipment");
  const [active, setActive] = useState("all");

  const filtered = useMemo(
    () =>
      (active === "all"
        ? items
        : items.filter((i) => i.topSlug === active)
      ).slice(0, DISPLAY),
    [active, items],
  );

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
            <FilterPills
              tops={tops}
              active={active}
              onSelect={setActive}
              allLabel={t("categories.All")}
              moreLabel={t("moreCategories")}
            />
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
          <>
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

            <Reveal delay={150}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginTop: 44,
                }}
              >
                <CtaButton href="/instruments" variant="primary">
                  {t("seeMore")} <Arrow />
                </CtaButton>
              </div>
            </Reveal>
          </>
        )}
      </Container>
    </Section>
  );
}

const PILL_BASE: CSSProperties = {
  borderRadius: 999,
  padding: "9px 16px",
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: "nowrap",
  lineHeight: 1.2,
  fontFamily: "inherit",
};

function pillStyle(selected: boolean): CSSProperties {
  return {
    ...PILL_BASE,
    background: selected ? "var(--color-brand)" : "transparent",
    color: selected ? "white" : "var(--color-text)",
    border: "none",
    cursor: "pointer",
    transition: "all 240ms cubic-bezier(.16,1,.3,1)",
    boxShadow: selected ? "var(--shadow-brand)" : "none",
  };
}

const morePillStyle: CSSProperties = {
  ...PILL_BASE,
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "transparent",
  color: "var(--color-brand-deep)",
  fontWeight: 600,
  textDecoration: "none",
  cursor: "pointer",
};

/** Width the pill bar's own padding + border consumes (6px×2 pad + 1px×2 border + safety). */
const BAR_INSET = 18;
const GAP = 8;

/**
 * Category filter pills constrained to a single row. Measures intrinsic pill
 * widths against the available track and shows only as many categories as fit,
 * collapsing the remainder behind an "and more" pill that links to the full
 * Instruments catalog. Re-measures on resize and after web fonts load.
 */
function FilterPills({
  tops,
  active,
  onSelect,
  allLabel,
  moreLabel,
}: {
  tops: TopCat[];
  active: string;
  onSelect: (slug: string) => void;
  allLabel: string;
  moreLabel: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const [visibleCats, setVisibleCats] = useState(tops.length);

  useEffect(() => {
    const measure = () => {
      const track = trackRef.current;
      const probe = probeRef.current;
      if (!track || !probe) return;
      const avail = track.clientWidth - BAR_INSET;
      const pills = Array.from(
        probe.querySelectorAll<HTMLElement>("[data-pill]"),
      );
      const moreEl = probe.querySelector<HTMLElement>("[data-more]");
      if (pills.length === 0) return;
      const moreW = moreEl ? moreEl.offsetWidth : 0;
      // pills[0] = "All" (always shown); pills[1..] = categories.
      let used = pills[0].offsetWidth;
      let catsFit = 0;
      for (let i = 1; i < pills.length; i++) {
        const w = GAP + pills[i].offsetWidth;
        const lastCat = i === pills.length - 1;
        const reserve = lastCat ? 0 : GAP + moreW; // room for "and more"
        if (used + w + reserve <= avail) {
          used += w;
          catsFit++;
        } else break;
      }
      setVisibleCats(catsFit);
      // If the active category just scrolled out of view, fall back to "All".
      if (
        active !== "all" &&
        !tops.slice(0, catsFit).some((c) => c.slug === active)
      ) {
        onSelect("all");
      }
    };

    measure();
    const ro = new ResizeObserver(measure);
    if (trackRef.current) ro.observe(trackRef.current);
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [tops, allLabel, moreLabel, active, onSelect]);

  const shownTops = tops.slice(0, visibleCats);
  const hasMore = visibleCats < tops.length;

  return (
    <div ref={trackRef} style={{ width: "100%", marginBottom: 28 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "nowrap",
          gap: GAP,
          padding: 6,
          background: "var(--color-surface)",
          borderRadius: 999,
          border: "1px solid var(--color-border)",
          width: "fit-content",
          maxWidth: "100%",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => onSelect("all")}
          style={pillStyle(active === "all")}
        >
          {allLabel}
        </button>
        {shownTops.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => onSelect(c.slug)}
            style={pillStyle(active === c.slug)}
          >
            {c.name}
          </button>
        ))}
        {hasMore && (
          <Link href="/instruments" style={morePillStyle}>
            {moreLabel} <Arrow />
          </Link>
        )}
      </div>

      {/* Hidden probe: full set of pills, used only to measure intrinsic widths. */}
      <div
        ref={probeRef}
        aria-hidden
        style={{
          position: "absolute",
          top: -9999,
          left: -9999,
          display: "flex",
          flexWrap: "nowrap",
          gap: GAP,
          visibility: "hidden",
          pointerEvents: "none",
          whiteSpace: "nowrap",
        }}
      >
        <span data-pill style={pillStyle(false)}>
          {allLabel}
        </span>
        {tops.map((c) => (
          <span key={c.slug} data-pill style={pillStyle(false)}>
            {c.name}
          </span>
        ))}
        <span data-more style={morePillStyle}>
          {moreLabel} <Arrow />
        </span>
      </div>
    </div>
  );
}
