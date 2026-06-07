"use client";

import React, { useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";

/* ───────────────────────────────────────────────────────────────────────────
 * NAVBAR THEME — recolors the navbar band (and the mobile drop-down).
 *
 * Pick ONE preset: uncomment its block and comment out the other two, then save.
 *   • Solid black → flush full-width header; SOLID at the top, glassmorphism on scroll. (active)
 *   • Pale teal tint → barely-there on-brand tint; keeps the dark text.
 *   • Frosted slate  → cool neutral tint; keeps the dark text.
 *
 * `alwaysOn: true` makes a flush full-width header (no floating pill, no white sides):
 *   - at the top of the page it shows `topBg` SOLID (no blur);
 *   - once scrolled it fades to `bg` (a translucent glassmorphism + backdrop blur).
 * Without `alwaysOn`, only the scrolled floating pill is themed (uses `bg`) and the
 * top-of-page bar is transparent.
 * `vars` are CSS custom properties scoped to the bar, so the nav links, language
 * switcher, cart/quote button and account menu all recolor together.
 * ─────────────────────────────────────────────────────────────────────────── */
type NavTheme = {
  bg: string; // scrolled background (glassmorphism when alwaysOn; the floating pill otherwise)
  topBg?: string; // alwaysOn only: SOLID background shown at the top, before scrolling
  menuBg: string;
  vars: React.CSSProperties;
  alwaysOn?: boolean; // flush full-width header that is themed at every scroll position
};

// ── Option 1 · Solid black → glassmorphism on scroll ── ◀ ACTIVE ──────────────
// Exported so the mega-menu drawer (which renders OUTSIDE NavBody and therefore
// inherits NONE of these vars) can re-declare the same dark token scope on its
// own panel root — single source of truth, no drift.
export const NAV_THEME: NavTheme = {
  alwaysOn: true, // flush full-width header (no floating pill / no white sides)
  topBg: "#000000", // completely solid black at the top of the page
  bg: "rgba(10, 13, 15, 0.62)", // dark glassmorphism once scrolled (kept opaque enough for AA text contrast over light content)
  menuBg: "#0a0b0d", // solid near-black mobile drop-down
  vars: {
    "--nav-hover-pill": "rgba(255,255,255,0.12)",
    "--color-text": "rgba(255,255,255,0.90)",
    "--color-text-strong": "#ffffff",
    "--color-text-muted": "rgba(255,255,255,0.72)",
    "--color-surface": "#141518", // neutral-dark so dropdown panels stay readable
    "--color-surface-2": "rgba(255,255,255,0.12)", // subtle hover lift
    "--color-border": "rgba(255,255,255,0.22)",
    "--color-hairline": "rgba(255,255,255,0.14)",
    "--color-brand-soft": "rgba(28,184,186,0.22)", // keep a teal accent on the avatar
    "--color-brand-deep": "var(--teal-100)",
  } as React.CSSProperties,
};

// ── Option 2 · Pale teal tint (light, subtle on-brand) ────────────────────────
// const NAV_THEME: NavTheme = {
//   bg: "rgba(238, 251, 251, 0.82)", // teal-50 glass
//   menuBg: "#ffffff",
//   vars: { "--nav-hover-pill": "var(--teal-100)" } as React.CSSProperties,
// };

// ── Option 3 · Frosted slate (light-neutral) ──────────────────────────────────
// const NAV_THEME: NavTheme = {
//   bg: "rgba(238, 241, 243, 0.82)", // slate glass
//   menuBg: "#ffffff",
//   vars: { "--nav-hover-pill": "var(--color-surface-2)" } as React.CSSProperties,
// };

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}

interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface NavItemsProps {
  items: { name: string; link: string }[];
  className?: string;
  onItemClick?: (item: { name: string; link: string }) => void;
  onItemHover?: (name: string | null) => void;
  /** Names of items that open a mega-drawer — get a chevron + aria-haspopup. */
  drawerItems?: Set<string>;
  /** The currently-open drawer (drives aria-expanded + chevron rotation). */
  openName?: string | null;
  /** Reports a drawer trigger's <a> element so the header can restore focus on Esc. */
  onTriggerRef?: (name: string, el: HTMLAnchorElement | null) => void;
}

/** Stable slug for trigger ids (aria-controls / focus restore). */
export function navTriggerId(name: string) {
  return `nav-trigger-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
}

interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}

interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}

interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 100);
  });

  return (
    <motion.div
      ref={ref}
      className={cn(
        "sticky inset-x-0 z-40 w-full",
        // alwaysOn presets are a flush full-width header; floating presets sit 1rem down.
        NAV_THEME.alwaysOn ? "top-0" : "top-4",
        className,
      )}
    >
      {/* Full-bleed themed band so the bar reaches both edges (no white sides).
          Top of page: SOLID topBg, no blur. Scrolled: translucent `bg` + backdrop
          blur (glassmorphism). The blur eases between 0 and full so the transition
          is smooth (transitioning to/from `none` would snap). */}
      {NAV_THEME.alwaysOn && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundColor: visible
              ? NAV_THEME.bg
              : (NAV_THEME.topBg ?? NAV_THEME.bg),
            backdropFilter: visible
              ? "blur(16px) saturate(180%)"
              : "blur(0px) saturate(100%)",
            WebkitBackdropFilter: visible
              ? "blur(16px) saturate(180%)"
              : "blur(0px) saturate(100%)",
            borderBottom: `1px solid ${visible ? "rgba(255,255,255,.12)" : "rgba(255,255,255,0)"}`,
            boxShadow: visible ? "0 14px 34px -22px rgba(0,0,0,.6)" : "none",
            transition:
              "background-color .45s ease, backdrop-filter .45s ease, -webkit-backdrop-filter .45s ease, border-color .45s ease, box-shadow .45s ease",
          }}
        />
      )}
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<{ visible?: boolean }>,
              { visible },
            )
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  const pinned = !!NAV_THEME.alwaysOn;
  const themed = visible || pinned;
  return (
    <motion.div
      animate={{
        // When pinned, the full-width band behind supplies the colour/blur/shadow.
        backdropFilter:
          themed && !pinned ? "blur(14px) saturate(180%)" : "blur(0px)",
        boxShadow:
          themed && !pinned
            ? "0 1px 2px rgba(10,31,44,.05), 0 12px 36px -8px rgba(10,31,44,.12), 0 0 0 1px rgba(10,31,44,.04)"
            : "none",
        backgroundColor:
          !pinned && themed ? NAV_THEME.bg : "rgba(255,255,255,0)",
        width: pinned ? "100%" : visible ? "72%" : "100%",
        y: pinned ? 0 : visible ? 8 : 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      style={{ minWidth: 820, ...(themed ? NAV_THEME.vars : null) }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-[1240px] flex-row items-center justify-between self-start rounded-full bg-transparent px-4 py-2 lg:flex",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({
  items,
  className,
  onItemClick,
  onItemHover,
  drawerItems,
  openName,
  onTriggerRef,
}: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const pathname = usePathname();
  const isActive = (link: string) =>
    link !== "#" &&
    (link === "/"
      ? pathname === "/"
      : pathname === link || pathname.startsWith(link + "/"));
  const activeIdx = items.findIndex((it) => isActive(it.link));
  // The underline rests on the active route; on hover it slides to the hovered
  // item (shared layout), then glides back to the active item on mouse-leave.
  const indicatorIdx = hovered ?? (activeIdx >= 0 ? activeIdx : null);

  return (
    <motion.div
      onMouseLeave={() => {
        setHovered(null);
        onItemHover?.(null);
      }}
      className={cn(
        "hidden flex-1 flex-row items-center justify-center text-sm font-medium lg:flex",
        className,
      )}
    >
      {items.map((item, idx) => {
        const hasDrawer = drawerItems?.has(item.name) ?? false;
        const expanded = hasDrawer && openName === item.name;
        return (
          <a
            onMouseEnter={() => {
              setHovered(idx);
              onItemHover?.(item.name);
            }}
            onFocus={(e) => {
              setHovered(idx);
              onItemHover?.(item.name);
              if (hasDrawer) onTriggerRef?.(item.name, e.currentTarget);
            }}
            onClick={(e) => {
              if (item.link === "#") e.preventDefault();
              onItemClick?.(item);
            }}
            ref={hasDrawer ? (el) => onTriggerRef?.(item.name, el) : undefined}
            className={cn(
              "nav-trigger relative flex items-center gap-1 px-3 py-2 whitespace-nowrap",
            )}
            style={{ color: "var(--color-text)" }}
            key={`link-${idx}`}
            href={item.link}
            id={hasDrawer ? navTriggerId(item.name) : undefined}
            aria-haspopup={hasDrawer ? "menu" : undefined}
            aria-expanded={hasDrawer ? expanded : undefined}
            aria-controls={hasDrawer ? "mega-drawer" : undefined}
          >
            {hovered === idx && (
              <motion.div
                layoutId="nav-hover"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 h-full w-full rounded-full"
                style={{ background: "var(--nav-hover-pill, var(--teal-50))" }}
              />
            )}
            {indicatorIdx === idx && (
              <motion.span
                layoutId="nav-underline"
                aria-hidden
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute"
                style={{
                  left: 12,
                  right: 12,
                  bottom: 5,
                  height: 2,
                  borderRadius: 2,
                  zIndex: 10,
                  background:
                    "linear-gradient(90deg, var(--teal-300), var(--aqua-400))",
                }}
              />
            )}
            <span
              className="relative z-20"
              style={{ color: "var(--color-text)" }}
            >
              {item.name}
            </span>
            {hasDrawer && (
              <span
                className="nav-chevron relative z-20"
                data-open={expanded}
                aria-hidden
                style={{
                  display: "inline-flex",
                  color: "var(--color-text-muted)",
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 9l6 6 6-6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            )}
          </a>
        );
      })}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  const pinned = !!NAV_THEME.alwaysOn;
  const themed = visible || pinned;
  return (
    <motion.div
      animate={{
        backdropFilter:
          themed && !pinned ? "blur(14px) saturate(180%)" : "blur(0px)",
        boxShadow:
          themed && !pinned
            ? "0 1px 2px rgba(10,31,44,.05), 0 12px 36px -8px rgba(10,31,44,.12), 0 0 0 1px rgba(10,31,44,.04)"
            : "none",
        backgroundColor:
          !pinned && themed ? NAV_THEME.bg : "rgba(255,255,255,0)",
        width: pinned ? "100%" : visible ? "92%" : "100%",
        paddingRight: pinned ? 16 : visible ? 12 : 0,
        paddingLeft: pinned ? 16 : visible ? 12 : 0,
        borderRadius: visible ? 16 : 24,
        y: pinned ? 0 : visible ? 8 : 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      style={themed ? NAV_THEME.vars : undefined}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col items-center justify-between bg-transparent px-0 py-2 lg:hidden",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({
  children,
  className,
}: MobileNavHeaderProps) => {
  return (
    <div
      className={cn(
        "flex w-full flex-row items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
};

export const MobileNavMenu = ({
  children,
  className,
  isOpen,
}: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-2 rounded-2xl px-4 py-6",
            className,
          )}
          style={{
            background: NAV_THEME.menuBg,
            ...NAV_THEME.vars,
            boxShadow:
              "0 1px 2px rgba(10,31,44,.05), 0 20px 60px -16px rgba(10,31,44,.18), 0 0 0 1px rgba(10,31,44,.04)",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({
  isOpen,
  onClick,
}: {
  isOpen: boolean;
  onClick: () => void;
}) => {
  return (
    <button
      onClick={onClick}
      aria-label={isOpen ? "Close menu" : "Open menu"}
      style={{
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 6,
        color: "var(--color-text-strong)",
      }}
    >
      {isOpen ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 6l12 12M6 18L18 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
};
