"use client";

import { type CSSProperties, type ReactNode } from "react";
import { Link, usePathname } from "@/i18n/navigation";

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: "/seller", label: "Dashboard" },
  { href: "/seller/products", label: "Products" },
  { href: "/seller/orders", label: "Orders" },
  { href: "/seller/payouts", label: "Payouts" },
  { href: "/seller/profile", label: "Profile" },
];

/**
 * Seller portal shell — left sidebar nav + top bar. English-literal strings
 * (matches the admin panel, no i18n). `usePathname()` from the locale-aware
 * router already returns the path WITHOUT the locale prefix, so we compare
 * directly against the `/seller/*` hrefs.
 */
export function SellerShell({
  children,
  sellerName,
}: {
  children: ReactNode;
  sellerName: string;
}) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/seller" ? pathname === "/seller" : pathname.startsWith(href);

  return (
    <div className="seller-shell" style={shellStyle}>
      <aside className="seller-sidebar" style={sidebarStyle}>
        <div style={brandStyle}>
          <span style={brandMarkStyle}>SM</span>
          <span style={brandTextStyle}>Seller</span>
        </div>
        <nav className="seller-nav" style={navStyle}>
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  ...navLinkStyle,
                  background: active ? "var(--color-surface-2)" : "transparent",
                  color: active
                    ? "var(--color-brand-deep)"
                    : "var(--color-text-muted)",
                  fontWeight: active ? 600 : 500,
                }}
              >
                {item.label}
              </Link>
            );
          })}
          <span data-divider style={dividerStyle} />
          <Link
            href="/kart"
            style={{ ...navLinkStyle, color: "var(--color-text-muted)" }}
          >
            ← Back to site
          </Link>
        </nav>
      </aside>

      <div style={mainWrapStyle}>
        <header style={topbarStyle}>
          <div style={{ display: "grid", gap: 2 }}>
            <strong style={{ color: "var(--color-text-strong)", fontSize: 15 }}>
              {sellerName}
            </strong>
            <span
              style={{
                color: "var(--color-text-muted)",
                fontSize: "var(--fs-caption)",
              }}
            >
              Seller dashboard
            </span>
          </div>
        </header>
        <main style={mainStyle}>{children}</main>
      </div>

      <style>{`
        @media (max-width: 820px) {
          .seller-shell { flex-direction: column !important; }
          .seller-sidebar {
            position: static !important;
            width: 100% !important;
            height: auto !important;
            border-right: 0 !important;
            border-bottom: 1px solid var(--color-border) !important;
          }
          .seller-nav {
            flex-direction: row !important;
            flex-wrap: wrap !important;
          }
          .seller-nav > span[data-divider] { display: none !important; }
        }
      `}</style>
    </div>
  );
}

const shellStyle: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  background: "var(--color-bg)",
};

const sidebarStyle: CSSProperties = {
  width: 240,
  flexShrink: 0,
  borderRight: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  padding: "var(--s-5)",
  display: "flex",
  flexDirection: "column",
  gap: "var(--s-5)",
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  height: "100vh",
};

const brandStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const brandMarkStyle: CSSProperties = {
  display: "inline-grid",
  placeItems: "center",
  width: 34,
  height: 34,
  borderRadius: "var(--r-md)",
  background: "var(--color-brand)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: 0.5,
};

const brandTextStyle: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: 18,
  color: "var(--color-text-strong)",
};

const navStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const navLinkStyle: CSSProperties = {
  display: "block",
  padding: "9px 12px",
  borderRadius: "var(--r-sm)",
  fontSize: 14,
  textDecoration: "none",
  transition: "background 160ms, color 160ms",
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "var(--color-border)",
  margin: "8px 0",
};

const mainWrapStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
};

const topbarStyle: CSSProperties = {
  height: 64,
  flexShrink: 0,
  borderBottom: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  display: "flex",
  alignItems: "center",
  paddingInline: "var(--s-6)",
  position: "sticky",
  top: 0,
  zIndex: 5,
};

const mainStyle: CSSProperties = {
  flex: 1,
  padding: "var(--s-6)",
  maxWidth: 1200,
  width: "100%",
};
