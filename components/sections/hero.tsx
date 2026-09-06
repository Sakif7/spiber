"use client";

import {
  CSSProperties,
  FocusEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  UIEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Arrow, Container, Reveal } from "@/components/ui";
import { useMagnetic } from "@/hooks";
import DotGrid from "@/components/ui/dot-grid";
import { colors } from "@/lib/design-tokens";
import { cn } from "@/lib/cn";
import { heroPosition } from "@/lib/hero-images";
import { Link } from "@/i18n/navigation";
import { CatalogSearch } from "@/components/search/catalog-search";

// `word` is the noun that follows the static "Empowering " prefix in the
// hero headline; `title` is the source tagline shown in the small indicator
// row above. They are intentionally separate — deriving `word` from `title`
// (e.g. last token) reads nonsensically for taglines like "...Right at Your
// Door" → "Empowering Door."
const HERO_TAGLINES = [
  {
    word: "Healthcare",
    title: "Empowering Healthcare",
    line: "SPIBER strives to empower and restore healthcare.",
  },
  {
    word: "Innovation",
    title: "Transforming Healthcare",
    line: "Committed to providing cutting-edge technology within reach.",
  },
  {
    word: "Access",
    title: "Cutting-Edge, Right at Your Door",
    line: "Assuring innovation across the healthcare industry.",
  },
  {
    word: "Care",
    title: "Uncompromised Medical Care",
    line: "Quality products for every stage of medical care.",
  },
  {
    word: "Skills",
    title: "Advancing Academic & Technical Skills",
    line: "Dazzling professionals with an advanced training system.",
  },
  {
    word: "Reach",
    title: "We Reach, Where Others Can't",
    line: "Delivering goods to any location quickly and with ease.",
  },
];

const HERO_PARTNERS = [
  "Aichi Healthcare Group",
  "TOP MRI & Medicto",
  "Mirror Hospital",
  "East West Medical",
  "Square Hospitals",
  "Labaid Hospital",
  "United Hospital",
  "Evercare Hospital",
  "Ibn Sina Hospital",
  "Popular Diagnostic",
  "Birdem General",
];

function TaglineRotator({ items }: { items: typeof HERO_TAGLINES }) {
  const t = useTranslations("home.hero");
  const taglines = t.raw("taglines") as Array<{
    word: string;
    title: string;
    line: string;
  }>;
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % items.length), 4200);
    return () => clearInterval(id);
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
        <span
          style={{ width: 24, height: 1, background: "var(--brand-teal)" }}
        />
        <div
          style={{
            position: "relative",
            flex: 1,
            height: 22,
            overflow: "hidden",
          }}
        >
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
                whiteSpace: "nowrap",
                transform: `translateY(${(i - idx) * 100}%)`,
                transition: "transform .7s cubic-bezier(.4,0,0,1)",
              }}
            >
              {taglines[i].title}
            </div>
          ))}
        </div>
      </div>

      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(32px, 6.4vw, 92px)",
          fontWeight: 500,
          lineHeight: 1,
          letterSpacing: "-0.035em",
          margin: "0 0 8px",
          textWrap: "balance" as CSSProperties["textWrap"],
          color: "var(--color-text-strong)",
        }}
      >
        <span style={{ display: "inline-block" }}>{t("headlinePrefix")} </span>
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
            {items.map((t, i) => (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  fontStyle: "italic",
                  fontFamily: "var(--font-serif)",
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
                {taglines[i].word}.
              </span>
            ))}
          </span>
        </span>
        <br />
        <span>{t("headlineSuffix")}</span>
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
            {taglines[i].line}
          </p>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Six-tile bento ─────────────────────────
   Layout, growth geometry and motion live in the `.hb-*` rules in
   globals.css (see the comment block there). This file owns the data, the
   open state (hover-intent / focus / tap) and the one measurement the CSS
   cannot make itself (--hb-dy). */

export type HeroTileId =
  | "medtrade"
  | "kart"
  | "digihealth"
  | "academy"
  | "tourism"
  | "health";

export type HeroChip = { label: string; href: string };

/** Live chips per tile (server-fetched categories); a missing tile falls back
 *  to the static chips in the message catalog. */
export type HeroLiveChips = Partial<Record<HeroTileId, HeroChip[]>>;

type IconKey =
  | "instruments"
  | "marketplace"
  | "systems"
  | "academy"
  | "plane"
  | "heart";

type HeroTile = {
  id: HeroTileId;
  href: string;
  image: string;
  icon: IconKey;
  /** The two 4-column tiles: drop the caption in narrow bentos (CSS). */
  small?: boolean;
  /** The photo tile is the likely LCP element — preload it. */
  priority?: boolean;
};

const HERO_TILES: HeroTile[] = [
  {
    id: "medtrade",
    href: "/medtrade",
    image: "/modern-operating-room-equipment.jpeg",
    icon: "instruments",
    priority: true,
  },
  {
    id: "kart",
    href: "/kart",
    image: "/icu-patient-blood-pressure-monitor.jpeg",
    icon: "marketplace",
  },
  {
    id: "digihealth",
    href: "/digihealth",
    image: "/bento-software.png",
    icon: "systems",
    small: true,
  },
  {
    id: "academy",
    href: "/medacademy",
    image: "/cpr-training-manikin-with-aed.jpeg",
    icon: "academy",
    small: true,
  },
  {
    id: "tourism",
    href: "/tourism",
    image: "/cherry-blossom-tree-lined-road.jpeg",
    icon: "plane",
  },
  {
    id: "health",
    href: "/health-corner",
    image: "/nurse-comforting-elderly-woman-home-care.jpeg",
    icon: "heart",
  },
];

/** Same `sizes` for the tile photo and the full-bleed background copy, so the
 *  browser fetches ONE optimized variant per photo and reuses it. */
const PHOTO_SIZES = "(max-width: 980px) 100vw, 720px";

/** Rail card width + gap, for the "01 / 06" counter (≤980 only). */
const RAIL_STEP = 312;

const ICONS: Record<IconKey, ReactNode> = {
  instruments: (
    <path d="M9 3v6.5L4.8 17a3 3 0 0 0 2.6 4.5h9.2A3 3 0 0 0 19.2 17L15 9.5V3M8 3h8M9 13h6" />
  ),
  marketplace: (
    <path d="M6 2 3 6v1a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V6l-3-4ZM5 10v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9M10 20v-5h4v5" />
  ),
  systems: <path d="M3 5h18v12H3zM3 9h18M8 21h8M12 17v4" />,
  academy: (
    <path d="M3 8.5 12 4l9 4.5-9 4.5-9-4.5Zm4 3v4.2c0 .9 2.2 2.3 5 2.3s5-1.4 5-2.3V11.5" />
  ),
  plane: (
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
  ),
  heart: (
    <>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <path d="M3.2 12h6.3l.5-1 2 4.5 2-7 1.5 3.5h5.3" />
    </>
  ),
};

function TileIcon({ icon }: { icon: IconKey }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[icon]}
    </svg>
  );
}

/** Touch devices that still get the bento (≥981px, no hover): first tap opens
 *  the card, second tap follows the link. Phones get the rail, where a tap
 *  simply navigates. */
function isTouchBento() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(hover: none)").matches &&
    window.matchMedia("(min-width: 981px)").matches
  );
}

function HeroBento({
  liveChips,
  active,
  onActiveChange,
}: {
  liveChips?: HeroLiveChips;
  active: HeroTileId | null;
  onActiveChange: (id: HeroTileId | null) => void;
}) {
  const t = useTranslations("home.hero");
  const rootRef = useRef<HTMLDivElement>(null);
  const intent = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tapped, setTapped] = useState<HeroTileId | null>(null);
  const [railIndex, setRailIndex] = useState(0);

  const clearIntent = () => {
    if (intent.current) clearTimeout(intent.current);
    intent.current = null;
  };
  useEffect(() => clearIntent, []);

  // --hb-dy: the hidden detail's height (+ the 12px gap), so the title block
  // can rest in the tile's corner while its natural place is the open layout.
  // Re-measured when the bento's width changes and once the fonts have loaded.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const apply = () => {
      root.querySelectorAll<HTMLElement>(".hb-tile").forEach((tile) => {
        const detail = tile.querySelector<HTMLElement>(".hb-detail");
        if (detail)
          tile.style.setProperty("--hb-dy", `${detail.offsetHeight + 12}px`);
      });
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(root);
    document.fonts?.ready.then(apply);
    return () => ro.disconnect();
  }, []);

  // A tap-opened card closes when the next tap lands outside the bento.
  useEffect(() => {
    if (!tapped) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      setTapped(null);
      onActiveChange(null);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [tapped, onActiveChange]);

  const onEnter = (id: HeroTileId) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || isTouchBento()) return;
    clearIntent();
    // 100ms hover-intent gate: sweeping across the grid opens nothing.
    intent.current = setTimeout(() => onActiveChange(id), 100);
  };
  const onLeave = (id: HeroTileId) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || isTouchBento()) return;
    clearIntent();
    if (active === id) onActiveChange(null);
  };
  const onBlur = (id: HeroTileId) => (e: FocusEvent<HTMLDivElement>) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    if (active === id) onActiveChange(null);
  };
  const onTitleClick =
    (id: HeroTileId) => (e: MouseEvent<HTMLAnchorElement>) => {
      if (!isTouchBento() || active === id) return;
      e.preventDefault();
      setTapped(id);
      onActiveChange(id);
    };
  const onRailScroll = (e: UIEvent<HTMLDivElement>) => {
    const i = Math.min(
      HERO_TILES.length - 1,
      Math.max(0, Math.round(e.currentTarget.scrollLeft / RAIL_STEP)),
    );
    if (i !== railIndex) setRailIndex(i);
  };

  const pad2 = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <div className="hb-rail-head">
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: "var(--brand-teal)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 18,
              height: 2,
              borderRadius: 2,
              background:
                "linear-gradient(90deg, var(--brand-teal), var(--aqua-400))",
            }}
          />
          {t("tilesLabel")}
        </span>
        <span
          aria-live="polite"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: ".14em",
            color: "var(--color-text-muted)",
          }}
        >
          {t("tilesCount", {
            index: pad2(railIndex + 1),
            total: pad2(HERO_TILES.length),
          })}
        </span>
      </div>

      <div
        ref={rootRef}
        className="hb"
        onScroll={onRailScroll}
        aria-label={t("tilesLabel")}
      >
        {HERO_TILES.map((tile) => {
          const open = active === tile.id;
          const chips =
            liveChips?.[tile.id] ??
            (t.raw(`tiles.${tile.id}.chips`) as HeroChip[]);
          return (
            <div
              key={tile.id}
              className={cn(
                "hb-tile",
                `hb-tile--${tile.id}`,
                tile.small && "hb-tile--sm",
              )}
              data-open={open ? "true" : undefined}
              onPointerEnter={onEnter(tile.id)}
              onPointerLeave={onLeave(tile.id)}
              onFocus={() => onActiveChange(tile.id)}
              onBlur={onBlur(tile.id)}
            >
              <div className="hb-panel">
                <div className="hb-bg">
                  <div className="hb-photo">
                    <Image
                      src={tile.image}
                      alt={t(`tiles.${tile.id}.imageAlt`)}
                      fill
                      priority={tile.priority}
                      sizes={PHOTO_SIZES}
                      style={{
                        objectFit: "cover",
                        objectPosition: heroPosition(tile.image),
                      }}
                    />
                  </div>
                </div>
                <div className="hb-scrim-rest" aria-hidden />
                <div className="hb-scrim-open" aria-hidden />
                <div className="hb-content">
                  <div className="hb-tblock">
                    <h3 className="hb-title">
                      <Link href={tile.href} onClick={onTitleClick(tile.id)}>
                        {t(`tiles.${tile.id}.title`)}
                      </Link>
                    </h3>
                    <p className="hb-sub">{t(`tiles.${tile.id}.sub`)}</p>
                    <span className="hb-brand">
                      {t(`tiles.${tile.id}.brand`)}
                    </span>
                  </div>
                  <div className="hb-detail">
                    <p className="hb-desc">{t(`tiles.${tile.id}.desc`)}</p>
                    <ul className="hb-chips">
                      {chips.map((c) => (
                        <li key={`${c.href}|${c.label}`}>
                          <Link href={c.href}>{c.label}</Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="hb-top" aria-hidden>
                  <span className="hb-glyph">
                    <TileIcon icon={tile.icon} />
                  </span>
                </div>
                <span className="hb-arrow" aria-hidden>
                  <Arrow size={12} />
                </span>
                <div className="hb-ring" aria-hidden />
              </div>
            </div>
          );
        })}
      </div>

      <div className="hb-dots" aria-hidden>
        {HERO_TILES.map((tile, i) => (
          <i key={tile.id} data-on={i === railIndex ? "true" : undefined} />
        ))}
      </div>
    </>
  );
}

/** Full-bleed photo behind the whole hero while a tile is open — the existing
 *  reveal. Each photo mounts the first time its tile opens (the tile's own
 *  copy is the same optimized variant, so it is normally already cached). */
function HeroBackground({
  activeId,
  seen,
}: {
  activeId: HeroTileId | null;
  seen: ReadonlySet<HeroTileId>;
}) {
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
      <DotGrid
        dotSize={4}
        gap={26}
        baseColor={colors.teal[100]}
        activeColor={colors.brand.teal}
        proximity={140}
        style={{ pointerEvents: "auto" }}
      />

      <motion.div
        animate={{ opacity: activeId ? 0.12 : 0.45 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="hero-blob"
        style={{
          width: 460,
          height: 460,
          top: 60,
          right: -100,
          background:
            "radial-gradient(circle, color-mix(in oklab, var(--brand-orange) 18%, transparent), transparent 70%)",
          animationDelay: "-8s",
        }}
      />

      {HERO_TILES.filter((tile) => seen.has(tile.id)).map((tile) => (
        <motion.div
          key={tile.id}
          initial={false}
          animate={{ opacity: activeId === tile.id ? 1 : 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "absolute",
            inset: 0,
          }}
        >
          <Image
            src={tile.image}
            alt=""
            fill
            // Mounted on first open, so "eager" just means "now" — and it keeps
            // Next's dev-only LCP heuristic quiet when a hover repaints the hero.
            loading="eager"
            sizes={PHOTO_SIZES}
            style={{
              objectFit: "cover",
              objectPosition: "center center",
              filter: "saturate(.85)",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to right, var(--color-surface) 0%, var(--color-surface) 32%, color-mix(in oklab, var(--color-surface) 68%, transparent) 52%, color-mix(in oklab, var(--color-surface) 30%, transparent) 75%, color-mix(in oklab, var(--color-surface) 10%, transparent) 100%)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

function PartnerMarquee() {
  return (
    <div
      style={{
        borderTop: "1px solid var(--teal-100)",
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

export function Hero({ chips }: { chips?: HeroLiveChips }) {
  const t = useTranslations("home.hero");
  const ctaMag = useMagnetic<HTMLAnchorElement>(0.22, 90);
  const [active, setActive] = useState<HeroTileId | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<HeroTileId>>(() => new Set());

  const onActiveChange = (id: HeroTileId | null) => {
    setActive(id);
    if (id) setSeen((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };

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
      <HeroBackground activeId={active} seen={seen} />
      <Container style={{ position: "relative", zIndex: 1 }}>
        <div
          className="hero-grid"
          style={{
            // Equal columns: the bento needs the width (540px at the capped
            // container), and the 92px headline still clears its column.
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 48,
            alignItems: "start",
            paddingTop: 40,
            paddingBottom: 40,
          }}
        >
          <Reveal>
            <div
              style={{
                width: "100%",
                maxWidth: 460,
                minHeight: 52,
                marginBottom: 26,
              }}
            >
              <CatalogSearch mode="overlay" />
            </div>

            <TaglineRotator items={HERO_TAGLINES} />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 36,
                gap: 18,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <Link
                  href="/kart"
                  style={{
                    background: "var(--color-surface)",
                    color: "var(--color-text-strong)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 999,
                    padding: "0 18px",
                    height: 44,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 10,
                    flexShrink: 0,
                    textDecoration: "none",
                    transition: "all .25s cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  {t("ctaMarketplace")} <Arrow size={14} />
                </Link>
                <Link
                  ref={ctaMag}
                  href="/medtrade"
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
                    flexShrink: 0,
                    textDecoration: "none",
                    transition: "all .25s cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  {t("ctaQuote")} <Arrow size={14} />
                </Link>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  flexWrap: "wrap",
                  color: "var(--color-text-muted)",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
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
                  {t("trustIso")}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
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
                  {t("trustBiomed")}
                </span>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <HeroBento
              liveChips={chips}
              active={active}
              onActiveChange={onActiveChange}
            />
            {/* Static, crawlable brand/entity line under the bento — names
                "Spiber Med" + what + where in the homepage's first text
                (the rotating headline above is evocative, not entity-defining).
                Helps branded + entity SEO while balancing the column. Fades out
                while a tile is open (so the revealed photo isn't overlaid by
                lingering text). */}
            <motion.p
              animate={{ opacity: active ? 0 : 1 }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
              style={{
                margin: "20px 2px 0",
                fontSize: 14.5,
                lineHeight: 1.6,
                color: "var(--color-text-muted)",
              }}
            >
              {t("brandLead")}
            </motion.p>
          </Reveal>
        </div>

        <Reveal>
          <PartnerMarquee />
        </Reveal>
      </Container>
    </section>
  );
}
