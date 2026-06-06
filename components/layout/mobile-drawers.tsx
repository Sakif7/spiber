"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "@/i18n/navigation";

type MegaItem = {
  key: string;
  title: string;
  href: string;
  links?: { label: string; href: string }[];
};
type NavCat = { id: string; slug: string; name: string };
type Mini = { slug: string; name: string };
type MpCat = { slug: string; name: string };

/**
 * Mobile / touch navigation drawers — a tap-to-expand accordion (NO hover).
 * One top section open at a time; Marketplace / Products / Systems / Services
 * lazy-fetch their catalog data on first expand and cache it. Subcategory depth
 * is intentionally cut on mobile: category taps jump to the listing page.
 */
export function MobileDrawers({
  products,
  services,
  onNavigate,
}: {
  products: MegaItem[];
  services: MegaItem[];
  onNavigate: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
      <Section
        label="Marketplace"
        open={open === "marketplace"}
        onToggle={() => toggle("marketplace")}
      >
        <MarketplacePanel onNavigate={onNavigate} />
      </Section>

      <Section
        label="Products & Solutions"
        open={open === "products"}
        onToggle={() => toggle("products")}
      >
        <ProductsPanel divisions={products} onNavigate={onNavigate} />
      </Section>

      <Section
        label="Services"
        open={open === "services"}
        onToggle={() => toggle("services")}
      >
        <ServicesPanel services={services} onNavigate={onNavigate} />
      </Section>
    </div>
  );
}

function Section({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const id = `m-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div
      style={{ width: "100%", borderTop: "1px solid var(--color-hairline)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={id}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          minHeight: 48,
          padding: "10px 4px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
          fontSize: 15,
          fontWeight: 600,
          color: "var(--color-text-strong)",
        }}
      >
        {label}
        <span
          className="nav-chevron"
          data-open={open}
          aria-hidden
          style={{ display: "inline-flex", color: "var(--color-text-muted)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 9l6 6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>
      {open && (
        <motion.div
          id={id}
          role="region"
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          style={{ paddingBottom: 8 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  );
}

function MobileLink({
  href,
  onNavigate,
  children,
  strong,
  indent,
}: {
  href: string;
  onNavigate: () => void;
  children: React.ReactNode;
  strong?: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      style={{
        display: "block",
        minHeight: 44,
        padding: indent ? "11px 8px 11px 16px" : "11px 8px",
        fontSize: strong ? 14.5 : 14,
        fontWeight: strong ? 600 : 400,
        color: strong ? "var(--color-text-strong)" : "var(--color-text-muted)",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

function MarketplacePanel({ onNavigate }: { onNavigate: () => void }) {
  const locale = useLocale();
  const [cats, setCats] = useState<MpCat[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/catalog/marketplace?locale=${locale}`)
      .then((r) => r.json())
      .then((j) => alive && j?.ok && setCats(j.data.categories))
      .catch(() => alive && setCats([]));
    return () => {
      alive = false;
    };
  }, [locale]);
  return (
    <div>
      <MobileLink href="/marketplace" onNavigate={onNavigate} strong>
        Shop all products
      </MobileLink>
      {cats === null && <Loading />}
      {cats?.map((c) => (
        <MobileLink
          key={c.slug}
          href={`/marketplace/category/${c.slug}`}
          onNavigate={onNavigate}
          indent
        >
          {c.name}
        </MobileLink>
      ))}
    </div>
  );
}

function ProductsPanel({
  divisions,
  onNavigate,
}: {
  divisions: MegaItem[];
  onNavigate: () => void;
}) {
  const locale = useLocale();
  const [cats, setCats] = useState<NavCat[] | null>(null);
  const [systems, setSystems] = useState<Mini[] | null>(null);
  const fetched = useRef(false);
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    fetch(`/api/catalog/nav?locale=${locale}`)
      .then((r) => r.json())
      .then((j) => j?.ok && setCats(j.data.categories))
      .catch(() => setCats([]));
    fetch(`/api/catalog/systems?locale=${locale}`)
      .then((r) => r.json())
      .then((j) => setSystems(j?.ok ? j.data.products : []))
      .catch(() => setSystems([]));
  }, [locale]);

  const instruments = divisions.find((d) => d.key === "instruments");
  const systemsDiv = divisions.find((d) => d.key === "systems");

  return (
    <div>
      {instruments && (
        <>
          <MobileLink href={instruments.href} onNavigate={onNavigate} strong>
            {instruments.title}
          </MobileLink>
          {cats === null && <Loading />}
          {cats?.map((c) => (
            <MobileLink
              key={c.id}
              href={`/instruments/${c.slug}`}
              onNavigate={onNavigate}
              indent
            >
              {c.name}
            </MobileLink>
          ))}
        </>
      )}
      {systemsDiv && (
        <>
          <MobileLink href={systemsDiv.href} onNavigate={onNavigate} strong>
            {systemsDiv.title}
          </MobileLink>
          {systems === null && <Loading />}
          {systems?.map((p) => (
            <MobileLink
              key={p.slug}
              href={`/systems/product/${p.slug}`}
              onNavigate={onNavigate}
              indent
            >
              {p.name}
            </MobileLink>
          ))}
        </>
      )}
    </div>
  );
}

function ServicesPanel({
  services,
  onNavigate,
}: {
  services: MegaItem[];
  onNavigate: () => void;
}) {
  return (
    <div>
      {services.map((s) => (
        <div key={s.key}>
          <MobileLink href={s.href} onNavigate={onNavigate} strong>
            {s.title}
          </MobileLink>
          {s.links?.map((l) => (
            <MobileLink
              key={l.href + l.label}
              href={l.href}
              onNavigate={onNavigate}
              indent
            >
              {l.label}
            </MobileLink>
          ))}
        </div>
      ))}
    </div>
  );
}

function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "6px 8px",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            height: 22,
            borderRadius: 6,
            background:
              "linear-gradient(90deg, rgba(255,255,255,.06), rgba(255,255,255,.12) 50%, rgba(255,255,255,.06))",
          }}
        />
      ))}
    </div>
  );
}
