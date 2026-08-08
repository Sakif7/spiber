"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  LayoutGrid,
  ChevronRight,
  ChevronDown,
  Flame,
  Sparkles,
  Tag,
  Store,
  PackageSearch,
  BadgePercent,
  HeartPulse,
  LifeBuoy,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CatalogSearch } from "@/components/search/catalog-search";

export type KartNavCategory = {
  id: string;
  name: string;
  slug: string;
  children: { id: string; name: string; slug: string }[];
};

/**
 * Spiber Kart shop-nav: a slim white bar directly under the global header.
 * Left = "Shop by category" trigger opening a mega-menu (left category rail +
 * right subcategory grid). Right = a scrollable row of quick links.
 * Chrome mirrors the Kart cards (teal accents, one radius rhythm, tinted
 * hover). Mega-menu opens on hover + click/focus; on <=768px it becomes a
 * stacked tap-to-expand accordion with no hover dependency.
 */
export function KartShopNav({ categories }: { categories: KartNavCategory[] }) {
  const t = useTranslations("marketplace.shopNav");
  const hasCategories = categories.length > 0;

  const quickLinks = [
    {
      href: "/kart/shop?sort=rating_desc",
      label: t("bestSellers"),
      Icon: Flame,
    },
    { href: "/kart/shop?sort=newest", label: t("newArrivals"), Icon: Sparkles },
    {
      // Real deals: products with a genuine compare-at discount (deal=1),
      // biggest catalog first — not the old price-asc stand-in.
      href: "/kart/shop?deal=1",
      label: t("offerZone"),
      Icon: BadgePercent,
    },
    { href: "/kart/brands", label: t("brands"), Icon: Tag },
    {
      href: "/kart/request-product",
      label: t("requestProduct"),
      Icon: PackageSearch,
    },
    { href: "/health-corner", label: t("healthCorner"), Icon: HeartPulse },
    { href: "/become-a-seller", label: t("becomeSeller"), Icon: Store },
    { href: "/contact", label: t("support"), Icon: LifeBuoy },
  ];

  return (
    <nav className="kart-shopnav" aria-label={t("shopByCategory")}>
      {/* Tier 1: category trigger + prominent search */}
      <div className="kart-shopnav-inner kart-shopnav-row1">
        {hasCategories && (
          <CategoryMenu
            categories={categories}
            label={t("shopByCategory")}
            shopAllIn={t}
          />
        )}
        <div className="kart-shopnav-search">
          <CatalogSearch mode="overlay" placeholder={t("searchPlaceholder")} />
        </div>
      </div>
      {/* Tier 2: quick links */}
      <div className="kart-shopnav-inner kart-shopnav-row2">
        <ul className="kart-shopnav-links">
          {quickLinks.map(({ href, label, Icon }) => (
            <li key={href} className="kart-shopnav-link-item">
              <Link href={href} className="kart-shopnav-link">
                <Icon size={15} strokeWidth={1.7} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

function CategoryMenu({
  categories,
  label,
  shopAllIn,
}: {
  categories: KartNavCategory[];
  label: string;
  shopAllIn: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  // Mobile-only: which top category is expanded in the accordion.
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeTimer = useRef<number | null>(null);
  const panelId = useId();

  // Only auto-open on hover for pointer devices; on touch (hover: none) a tap
  // fires mouseenter then click, which would open-then-close, so we let the
  // trigger's onClick own opening there.
  const canHover = () =>
    typeof window !== "undefined" &&
    window.matchMedia?.("(hover: hover)").matches;

  const active = categories.find((c) => c.id === activeId) ?? categories[0];

  const openMenu = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setActiveId((id) => id || categories[0]?.id || "");
    setOpen(true);
  };
  const closeMenu = () => setOpen(false);

  // Delay close so a quick slip between trigger and panel does not flicker.
  const scheduleClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 120);
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(
    () => () => {
      if (closeTimer.current) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) {
      setOpen(false);
      triggerRef.current?.focus();
    }
  };

  return (
    <div
      className="kart-shopnav-catwrap"
      ref={rootRef}
      onMouseEnter={() => canHover() && openMenu()}
      onMouseLeave={() => canHover() && scheduleClose()}
      onKeyDown={onKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        className="kart-shopnav-trigger"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        data-open={open}
        onClick={() => (open ? closeMenu() : openMenu())}
      >
        <LayoutGrid size={17} strokeWidth={1.8} aria-hidden />
        <span>{label}</span>
        <ChevronDown
          size={15}
          strokeWidth={2}
          aria-hidden
          className="kart-shopnav-trigger-caret"
        />
      </button>

      <div
        id={panelId}
        className="kart-shopnav-panel"
        aria-label={label}
        data-open={open}
        hidden={!open}
      >
        {/* Left rail: top categories (desktop). Doubles as accordion on mobile. */}
        <ul className="kart-shopnav-rail">
          {categories.map((c) => {
            const isActive = c.id === active?.id;
            const isExpanded = expandedId === c.id;
            return (
              <li key={c.id} className="kart-shopnav-rail-item">
                {/* Desktop row: hover/focus sets the active category. */}
                <Link
                  href={`/kart/category/${c.slug}`}
                  className="kart-shopnav-rail-link"
                  data-active={isActive}
                  onMouseEnter={() => setActiveId(c.id)}
                  onFocus={() => setActiveId(c.id)}
                >
                  <span>{c.name}</span>
                  <ChevronRight size={15} strokeWidth={2} aria-hidden />
                </Link>

                {/* Mobile-only expander toggle for this category's children. */}
                {c.children.length > 0 && (
                  <button
                    type="button"
                    className="kart-shopnav-rail-toggle"
                    aria-expanded={isExpanded}
                    aria-label={c.name}
                    onClick={() =>
                      setExpandedId((id) => (id === c.id ? null : c.id))
                    }
                  >
                    <ChevronDown
                      size={18}
                      strokeWidth={2}
                      aria-hidden
                      data-open={isExpanded}
                    />
                  </button>
                )}

                {/* Mobile-only children list, shown when expanded. */}
                <ul
                  className="kart-shopnav-mobile-children"
                  data-open={isExpanded}
                  hidden={!isExpanded}
                >
                  <li>
                    <Link
                      href={`/kart/category/${c.slug}`}
                      className="kart-shopnav-shopall"
                    >
                      {shopAllIn("shopAllIn", { name: c.name })}
                    </Link>
                  </li>
                  {c.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/kart/category/${sub.slug}`}
                        className="kart-shopnav-sublink"
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>

        {/* Right area: active category's subcategories (desktop only). */}
        <div className="kart-shopnav-detail">
          {active && (
            <>
              <Link
                href={`/kart/category/${active.slug}`}
                className="kart-shopnav-shopall kart-shopnav-shopall-lg"
              >
                {shopAllIn("shopAllIn", { name: active.name })}
                <ChevronRight size={16} strokeWidth={2} aria-hidden />
              </Link>
              {active.children.length > 0 && (
                <ul className="kart-shopnav-subgrid">
                  {active.children.map((sub) => (
                    <li key={sub.id}>
                      <Link
                        href={`/kart/category/${sub.slug}`}
                        className="kart-shopnav-sublink"
                      >
                        {sub.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
