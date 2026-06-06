"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Arrow, LocaleSwitcher } from "@/components/ui";
import { Link, usePathname } from "@/i18n/navigation";
import { StorefrontAction } from "@/components/shop/storefront-action";
import { UserMenu } from "@/components/layout/user-menu";
import { ProductsMega } from "@/components/layout/products-mega";
import { ServicesMega } from "@/components/layout/services-mega";
import { MarketplaceMega } from "@/components/layout/marketplace-mega";
import { MobileDrawers } from "@/components/layout/mobile-drawers";
import { useSession } from "@/components/auth/use-session";
import { useAuthModal } from "@/components/auth/auth-modal";
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  NavItems,
  Navbar,
  NAV_THEME,
  navTriggerId,
} from "@/components/ui/resizable-navbar";

/**
 * The mega-drawer renders OUTSIDE NavBody and so inherits NONE of the navbar's
 * dark CSS vars — re-declare them on the panel root. `--color-brand-deep` is
 * overridden to teal-300 (the :root teal-700 fails contrast on black) and
 * `--color-surface-2` is dialled down for a quiet neutral hover (active rows use
 * teal instead). Single source of truth = the exported NAV_THEME.vars.
 */
const PANEL_DARK_VARS: React.CSSProperties = {
  ...NAV_THEME.vars,
  "--color-brand-deep": "var(--teal-300)",
  "--color-surface-2": "rgba(255,255,255,0.08)",
} as React.CSSProperties;

// Only these nav items open a drawer (gate the chevron/aria on the NAME, not
// link==='#': Marketplace has a real href yet still opens a drawer).
const NAV_DRAWERS = new Set([
  "Marketplace",
  "Products & Solutions",
  "Services",
]);

const MotionLink = motion.create(Link);

const NAV_ITEMS = [
  { name: "Home", link: "/" },
  { name: "Marketplace", link: "/marketplace" },
  { name: "Products & Solutions", link: "#" },
  { name: "Services", link: "#" },
  { name: "Blog", link: "/blog" },
  { name: "About", link: "/about" },
];

// Two-tone division scheme: products are teal, services are orange.
type Tone = "teal" | "orange";

type MegaItem = {
  key: string;
  kicker: string;
  title: string;
  desc: string;
  href: string;
  tone: Tone;
  links?: { label: string; href: string }[];
};

const MEGA_MENUS: Record<string, MegaItem[]> = {
  "Products & Solutions": [
    {
      key: "instruments",
      kicker: "Medical Devices",
      title: "Spiber Instruments",
      desc: "Clinical-grade medical and surgical equipment, calibrated for real clinical workloads and serviced for the long run.",
      href: "/instruments",
      tone: "teal",
    },
    {
      key: "systems",
      kicker: "Digital Health",
      title: "Spiber Systems",
      desc: "HIS, EMR, and telemedicine platforms, plus custom digital-health builds hosted in Bangladesh.",
      href: "/systems",
      tone: "teal",
    },
  ],
  Services: [
    {
      key: "academy",
      kicker: "Training & Education",
      title: "Spiber Academy",
      desc: "Accredited programmes and hands-on training for doctors, nurses, and biomedical technicians.",
      href: "/academy",
      tone: "orange",
      links: [
        { label: "Browse courses", href: "/academy/courses" },
        { label: "All programmes", href: "/academy" },
      ],
    },
    {
      key: "tourism",
      kicker: "Medical Tourism",
      title: "Spiber Tourism",
      desc: "Curated treatment packages with accredited partner facilities, plus travel and air-ticket support.",
      href: "/tourism",
      tone: "orange",
      links: [
        { label: "Explore packages", href: "/tourism" },
        { label: "Plan a medical trip", href: "/contact" },
      ],
    },
    {
      key: "consulting",
      kicker: "Advisory",
      title: "Spiber Consulting",
      desc: "Strategic management and advisory services for hospitals and healthcare organisations.",
      href: "/consulting",
      tone: "orange",
      links: [
        { label: "Our services", href: "/consulting" },
        { label: "Book a consultation", href: "/contact" },
      ],
    },
  ],
};

export function ResizableHeader() {
  const [open, setOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState<string | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggers = useRef<Map<string, HTMLAnchorElement>>(new Map());
  // After Escape we restore focus to the trigger, whose onFocus would otherwise
  // immediately reopen the drawer — briefly suppress opens to prevent that.
  const suppressUntil = useRef(0);
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const { open: openAuth } = useAuthModal();

  // Close the drawer (and mobile menu) on ANY route change — covers Link
  // clicks, programmatic navs and browser back/forward, so focus is never
  // trapped after navigating. Guarded state-adjustment during render is React's
  // recommended alternative to a set-state-in-effect.
  const [seenPath, setSeenPath] = useState(pathname);
  if (seenPath !== pathname) {
    setSeenPath(pathname);
    if (megaOpen !== null) setMegaOpen(null);
    if (open) setOpen(false);
  }

  // Escape closes the drawer and returns focus to its trigger.
  useEffect(() => {
    if (!megaOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const name = megaOpen;
        setMegaOpen(null);
        suppressUntil.current = performance.now() + 250;
        triggers.current.get(name)?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [megaOpen]);

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const cancelOpen = () => {
    if (openTimer.current) {
      clearTimeout(openTimer.current);
      openTimer.current = null;
    }
  };
  // Hover-intent: 100ms to open (so a fast pass-through doesn't flash the panel),
  // 200ms to close (bridges the trigger→panel gap). Switching between two open
  // drawers is instant (no dead frame).
  const scheduleClose = () => {
    cancelOpen();
    cancelClose();
    closeTimer.current = setTimeout(() => setMegaOpen(null), 200);
  };
  const scheduleOpen = (name: string) => {
    if (performance.now() < suppressUntil.current) return; // just Escaped — ignore the focus-restore reopen
    cancelClose();
    cancelOpen();
    if (megaOpen && megaOpen !== name) {
      setMegaOpen(name);
    } else if (!megaOpen) {
      openTimer.current = setTimeout(() => setMegaOpen(name), 100);
    }
  };
  const onItemHover = (name: string | null) => {
    if (name && NAV_DRAWERS.has(name)) scheduleOpen(name);
    else scheduleClose();
  };
  const setTrigger = (name: string, el: HTMLAnchorElement | null) => {
    if (el) triggers.current.set(name, el);
    else triggers.current.delete(name);
  };

  return (
    <Navbar>
      <NavBody>
        <Logo />
        <NavItems
          items={NAV_ITEMS}
          drawerItems={NAV_DRAWERS}
          openName={megaOpen}
          onTriggerRef={setTrigger}
          onItemHover={onItemHover}
          onItemClick={() => setOpen(false)}
        />
        <DesktopActions />
      </NavBody>

      <MegaMenu
        open={megaOpen}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        onNavigate={() => setMegaOpen(null)}
      />

      <MobileNav>
        <MobileNavHeader>
          <Logo />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <StorefrontAction />
            <MobileNavToggle isOpen={open} onClick={() => setOpen((o) => !o)} />
          </div>
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          <MobileLink href="/" onClick={() => setOpen(false)}>
            Home
          </MobileLink>
          <MobileDrawers
            products={MEGA_MENUS["Products & Solutions"]}
            services={MEGA_MENUS["Services"]}
            onNavigate={() => setOpen(false)}
          />
          <MobileLink href="/blog" onClick={() => setOpen(false)}>
            Blog
          </MobileLink>
          <MobileLink href="/about" onClick={() => setOpen(false)}>
            About
          </MobileLink>
          <div
            style={{ display: "flex", gap: 10, marginTop: 14, width: "100%" }}
          >
            {user ? (
              <Link
                href={user.isAdmin ? "/admin" : "/account/orders"}
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                  color: "var(--color-text)",
                }}
              >
                {user.isAdmin ? "Admin" : "My account"}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  openAuth("login");
                }}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "10px 14px",
                  borderRadius: 999,
                  border: "1px solid var(--color-border)",
                  fontSize: 13,
                  color: "var(--color-text)",
                  background: "none",
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                Login
              </button>
            )}
            <CtaButton style={{ flex: 1, justifyContent: "center" }} />
          </div>
          {user && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOut();
              }}
              style={{
                marginTop: 10,
                width: "100%",
                padding: 8,
                background: "none",
                border: "none",
                color: "var(--color-error)",
                fontSize: 13,
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          )}
          <div style={{ marginTop: 14 }}>
            <LocaleSwitcher />
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}

function MobileLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        fontSize: 15,
        fontWeight: 500,
        color: "var(--color-text-strong)",
        padding: "8px 4px",
        width: "100%",
      }}
    >
      {children}
    </Link>
  );
}

function MegaMenu({
  open,
  onMouseEnter,
  onMouseLeave,
  onNavigate,
}: {
  open: string | null;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onNavigate: () => void;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const isProducts = open === "Products & Solutions";
  const isMarketplace = open === "Marketplace";
  const services =
    open && !isProducts && !isMarketplace ? MEGA_MENUS[open] : null;
  const show = isProducts || isMarketplace || !!services;

  // Shared positioning for EVERY drawer: anchor the panel's left edge under its
  // own trigger and extend right; if it would overflow the right edge, shift it
  // left just enough to stay fully on-screen (never causing horizontal scroll).
  // The trigger is found by id so no per-item wiring is needed.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    const trigger = document.getElementById(navTriggerId(open));
    if (!trigger) return;
    const apply = () => {
      const margin = 16;
      const vw = document.documentElement.clientWidth;
      const tLeft = trigger.getBoundingClientRect().left;
      const w = panel.getBoundingClientRect().width;
      const left = Math.max(margin, Math.min(tLeft, vw - margin - w));
      panel.style.marginLeft = `${left}px`;
      // Bound growth (open sub-columns) to the space remaining on the right, so
      // the panel never pushes past the viewport — inner columns scroll instead.
      panel.style.maxWidth = `${vw - left - margin}px`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [open]);

  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -8, scale: 0.985 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -8, scale: 0.985 },
      };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={open}
          {...motionProps}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="hidden lg:block"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            // Transparent hover bridge so there's no dead zone between the
            // trigger and the panel (the panel onMouseEnter cancels the close).
            paddingTop: 10,
            zIndex: 70,
          }}
        >
          <div
            ref={panelRef}
            className="mega"
            id="mega-drawer"
            role="menu"
            aria-label={open ?? undefined}
            style={{
              ...PANEL_DARK_VARS,
              display: "flex",
              // Size to content (no empty space); positioned via marginLeft by
              // the layout effect above. maxWidth is set there too.
              width: "max-content",
              maxWidth: "calc(100vw - 32px)",
              background: "rgba(18,19,22,0.97)",
              backdropFilter: "saturate(180%) blur(20px)",
              WebkitBackdropFilter: "saturate(180%) blur(20px)",
              border: "1px solid var(--color-hairline)",
              borderRadius: 20,
              boxShadow:
                "0 1px 2px rgba(0,0,0,.5), 0 30px 80px -24px rgba(0,0,0,.7), 0 0 0 1px rgba(255,255,255,.05)",
              overflow: "hidden",
              color: "var(--color-text)",
            }}
          >
            {isProducts ? (
              <ProductsMega
                divisions={MEGA_MENUS["Products & Solutions"]}
                onNavigate={onNavigate}
              />
            ) : isMarketplace ? (
              <MarketplaceMega onNavigate={onNavigate} />
            ) : (
              services && (
                <ServicesMega items={services} onNavigate={onNavigate} />
              )
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Logo() {
  return (
    <Link
      href="/"
      className="relative z-20 flex items-center"
      style={{ paddingInline: 4, flexShrink: 0 }}
      aria-label="SPIBER MED"
    >
      <Image
        src="/spibermed-wordmark.png"
        alt="SPIBER MED"
        width={932}
        height={355}
        priority
        style={{
          height: 34,
          width: "auto",
          maxWidth: "none",
          flexShrink: 0,
          display: "block",
        }}
      />
    </Link>
  );
}

function DesktopActions() {
  return (
    <div
      className="relative z-20"
      style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}
    >
      <LocaleSwitcher />
      <StorefrontAction />
      <UserMenu />
      <CtaButton />
    </div>
  );
}

function CtaButton({ style }: { style?: React.CSSProperties }) {
  return (
    <MotionLink
      href="/contact"
      whileHover={{ y: -2 }}
      whileTap={{ y: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      style={{
        background: "var(--color-brand)",
        color: "white",
        borderRadius: 999,
        padding: "10px 18px",
        fontSize: 13,
        fontWeight: 500,
        cursor: "pointer",
        boxShadow: "var(--shadow-brand)",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        textDecoration: "none",
        ...style,
      }}
    >
      Request a Quote <Arrow />
    </MotionLink>
  );
}
