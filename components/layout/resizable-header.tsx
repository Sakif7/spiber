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
import { CompanyMega } from "@/components/layout/company-mega";
import {
  MobileDrawers,
  MobileCompanyDrawer,
} from "@/components/layout/mobile-drawers";
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
  "Company",
]);

const MotionLink = motion.create(Link);

const NAV_ITEMS = [
  { name: "Home", link: "/" },
  { name: "Marketplace", link: "/marketplace" },
  { name: "Products & Solutions", link: "#" },
  { name: "Services", link: "#" },
  { name: "Blog", link: "/blog" },
  { name: "Company", link: "#" },
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
      title: "Spiber Medtrade",
      desc: "Clinical-grade medical and surgical equipment, calibrated for real clinical workloads and serviced for the long run.",
      href: "/medtrade",
      tone: "teal",
    },
    {
      key: "systems",
      kicker: "Digital Health",
      title: "Spiber Digihealth",
      desc: "HIS, EMR, and telemedicine platforms, plus custom digital-health builds hosted in Bangladesh.",
      href: "/digihealth",
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
        { label: "Medical tourism", href: "/tourism/medical-tourism" },
        { label: "Find a doctor", href: "/tourism/doctors" },
        { label: "Hospitals network", href: "/tourism/hospitals" },
        { label: "Surgery & health packages", href: "/tourism/packages" },
        { label: "Teleconsultation", href: "/tourism/telemedicine" },
        { label: "Air tickets", href: "/tourism/air-tickets" },
        { label: "Visa assistance", href: "/tourism/visa" },
        { label: "Partner with us", href: "/tourism/partner" },
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
  Company: [
    {
      key: "about",
      kicker: "Who we are",
      title: "About us",
      desc: "Our story, mission, and the leadership team behind Spiber Med.",
      href: "/company/about",
      tone: "teal",
    },
    {
      key: "philosophy",
      kicker: "What drives us",
      title: "Corporate Philosophy",
      desc: "The vision, mission, motto, and core values that guide every decision we make.",
      href: "/company/corporate-philosophy",
      tone: "teal",
    },
    {
      key: "vision",
      kicker: "Long-term vision",
      title: "Design the Future 2040",
      desc: "How we’re reshaping healthcare in Bangladesh and beyond on the road to 2040.",
      href: "/company/vision-2040",
      tone: "teal",
    },
    {
      key: "career",
      kicker: "Join the team",
      title: "Career",
      desc: "Open roles and what it’s like to build a healthier future with us.",
      href: "/company/career",
      tone: "teal",
    },
    {
      key: "gallery",
      kicker: "In pictures",
      title: "Gallery",
      desc: "Moments from our projects, installations, training, and milestones.",
      href: "/company/gallery",
      tone: "teal",
    },
    {
      key: "events",
      kicker: "What’s on",
      title: "Events",
      desc: "Conferences, workshops, and announcements from across Spiber Med.",
      href: "/company/events",
      tone: "teal",
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
          <MobileCompanyDrawer
            items={MEGA_MENUS.Company}
            onNavigate={() => setOpen(false)}
          />
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
  const isCompany = open === "Company";
  const services =
    open && !isProducts && !isMarketplace && !isCompany
      ? MEGA_MENUS[open]
      : null;
  const show = isProducts || isMarketplace || isCompany || !!services;

  // Shared positioning + fit for EVERY drawer. Anchor the panel's left edge
  // under its own trigger, then shift it LEFT as far as needed (down to a 16px
  // margin) so freshly-opened cascade columns stay fully on-screen — this is the
  // dynamic "make room" behaviour. If even at the margin the full width can't
  // fit (a deep cascade on a narrow laptop), scale the whole panel down a touch
  // as a last resort so nothing is ever cut off. Re-runs as deeper levels open
  // (ResizeObserver on the panel) and on viewport resize. Trigger found by id.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    const trigger = document.getElementById(navTriggerId(open));
    if (!trigger) return;
    const MARGIN = 16;
    const MIN_SCALE = 0.8; // below this, fall back to inner column scroll
    const place = () => {
      const vw = document.documentElement.clientWidth;
      // Measure the panel's NATURAL (uncapped, unscaled) content width.
      // offsetWidth is the layout width — unaffected by CSS transforms (the
      // wrapper's enter animation or our own fit-scale) — so it's stable to read
      // at any time. max-content propagates the column widths up through the
      // inner overflow-x:auto scroller, so this is the true full width.
      panel.style.maxWidth = "none";
      panel.style.transform = "none";
      const natural = panel.offsetWidth;
      const avail = vw - MARGIN * 2;
      const scale = natural > avail ? Math.max(MIN_SCALE, avail / natural) : 1;
      const visualW = natural * scale;
      // Full width fits after the (possible) scale → no inner scroll. Only when
      // even the floor scale overflows do we cap the layout width so the inner
      // columns absorb just the residual.
      panel.style.maxWidth =
        visualW > avail ? `${Math.floor(avail / scale)}px` : `${natural}px`;
      const w = Math.min(visualW, avail);
      const tLeft = trigger.getBoundingClientRect().left;
      const left = Math.max(MARGIN, Math.min(tLeft, vw - MARGIN - w));
      panel.style.transformOrigin = "top left";
      panel.style.transform = scale < 1 ? `scale(${scale})` : "none";
      panel.style.marginLeft = `${left}px`;
    };
    place();
    // A cascade level opening/closing (or async catalog data arriving) changes
    // the panel's content width — re-place so the shift-left/scale adapts. The
    // callback only writes position/transform/maxWidth(=natural), none of which
    // change the observed layout width, so it converges without looping.
    const ro = new ResizeObserver(() => place());
    ro.observe(panel);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // Absorb the wheel while the drawer is open: a hovered column scrolls itself,
  // but the page behind never scrolls (fixes "the page scrolls instead of the
  // drawer"). Native non-passive listener so preventDefault actually applies.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || !open) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // leave horizontal alone
      const col = (e.target as HTMLElement).closest<HTMLElement>(".mega-col");
      if (col && col.scrollHeight > col.clientHeight) {
        const atTop = col.scrollTop <= 0;
        const atBottom =
          col.scrollTop + col.clientHeight >= col.scrollHeight - 1;
        // The column can still scroll in this direction — let it.
        if (!((e.deltaY < 0 && atTop) || (e.deltaY > 0 && atBottom))) return;
      }
      e.preventDefault();
    };
    panel.addEventListener("wheel", onWheel, { passive: false });
    return () => panel.removeEventListener("wheel", onWheel);
  }, [open]);

  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: -18, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -12, scale: 0.965 },
      };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={open}
          {...motionProps}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
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
            transformOrigin: "top center",
            zIndex: 70,
          }}
        >
          <div
            ref={panelRef}
            className="mega"
            id="mega-drawer"
            role="menu"
            aria-label={open ?? undefined}
            // The home page mounts a global window Lenis (smooth-scroll, via the
            // Pillars ScrollStack) that otherwise hijacks the wheel/touch and
            // scrolls the PAGE instead of the hovered drawer column. This marker
            // tells Lenis to ignore gestures inside the panel so the columns
            // scroll natively (overscroll-behavior:contain + the wheel handler
            // below keep that scroll from chaining to the page).
            data-lenis-prevent=""
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
            ) : isCompany ? (
              <CompanyMega items={MEGA_MENUS.Company} onNavigate={onNavigate} />
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
      Contact <Arrow />
    </MotionLink>
  );
}
