"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Arrow, Container, LocaleSwitcher } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { StorefrontAction } from "@/components/shop/storefront-action";
import { UserMenu } from "@/components/layout/user-menu";
import { ProductsMega } from "@/components/layout/products-mega";
import { ServicesMega } from "@/components/layout/services-mega";
import { MarketplaceMega } from "@/components/layout/marketplace-mega";
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
} from "@/components/ui/resizable-navbar";

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
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user, signOut } = useSession();
  const { open: openAuth } = useAuthModal();

  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMegaOpen(null), 140);
  };
  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openMega = (name: string | null) => {
    cancelClose();
    if (name && (MEGA_MENUS[name] || name === "Marketplace")) setMegaOpen(name);
    else setMegaOpen(null);
  };

  return (
    <Navbar>
      <NavBody>
        <Logo />
        <NavItems
          items={NAV_ITEMS}
          onItemHover={(name) => (name ? openMega(name) : scheduleClose())}
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
          <MobileLink href="/marketplace" onClick={() => setOpen(false)}>
            Marketplace
          </MobileLink>
          {Object.entries(MEGA_MENUS).map(([label, items]) => (
            <div key={label} style={{ width: "100%" }}>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: ".14em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  padding: "12px 4px 4px",
                }}
              >
                {label}
              </div>
              {items.map((it) => (
                <MobileLink
                  key={it.key}
                  href={it.href}
                  onClick={() => setOpen(false)}
                >
                  {it.title}
                </MobileLink>
              ))}
            </div>
          ))}
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
  const isProducts = open === "Products & Solutions";
  const isMarketplace = open === "Marketplace";
  const services =
    open && !isProducts && !isMarketplace ? MEGA_MENUS[open] : null;
  const show = isProducts || isMarketplace || !!services;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={open}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          className="hidden lg:block"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 14,
            zIndex: 70,
          }}
        >
          <Container style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: "100%",
                maxWidth: isProducts ? 820 : isMarketplace ? 900 : 760,
                background: "rgba(255,255,255,0.98)",
                backdropFilter: "saturate(180%) blur(20px)",
                WebkitBackdropFilter: "saturate(180%) blur(20px)",
                border: "1px solid var(--color-hairline)",
                borderRadius: 24,
                boxShadow:
                  "0 1px 2px rgba(10,31,44,.05), 0 32px 80px -24px rgba(10,31,44,.22), 0 0 0 1px rgba(10,31,44,.04)",
                overflow: "hidden",
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
          </Container>
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
        src="/spibermed-logo.png"
        alt="SPIBER MED"
        width={1007}
        height={301}
        priority
        style={{
          height: 30,
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
