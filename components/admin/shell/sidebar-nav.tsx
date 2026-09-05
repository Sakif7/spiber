"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { ChevronDown, Clock, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NAV_BY_ID,
  NAV_SECTIONS,
  activeItemFor,
  type AdminSection,
  type NavGroup,
  type NavItem,
} from "./nav";
import { useAdminPrefs } from "./admin-prefs";

/**
 * The admin navigation tree. Shared by the desktop sidebar and the mobile
 * drawer. From top to bottom: the admin's pinned Favourites, their Recent
 * pages, the section's labelled groups (accordions — the group holding the
 * current page opens automatically, explicit open/close choices persist per
 * browser in localStorage), and rarely used groups behind a "More" disclosure.
 * When `collapsed`, items render icon-only with a tooltip label; accordions
 * are meaningless at that width, so every item shows.
 */

const OPEN_KEY = "spiber-admin-nav-open";
const OPEN_EVENT = "spiber-admin-nav-open-changed";
const MORE_KEY = "More";

function subscribeOpen(cb: () => void) {
  window.addEventListener(OPEN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(OPEN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
// The snapshot is the raw JSON string (stable reference), parsed in render.
function readOpenRaw(): string {
  return typeof window !== "undefined"
    ? (localStorage.getItem(OPEN_KEY) ?? "")
    : "";
}
function parseOverrides(raw: string): Record<string, boolean> {
  if (!raw) return {};
  try {
    const val = JSON.parse(raw) as unknown;
    return val && typeof val === "object"
      ? (val as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}
function writeOverrides(next: Record<string, boolean>) {
  localStorage.setItem(OPEN_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(OPEN_EVENT));
}
function setOverride(label: string, open: boolean) {
  writeOverrides({ ...parseOverrides(readOpenRaw()), [label]: open });
}

const HEAD_CLASS =
  "group/head flex w-full items-center justify-between rounded-md px-2 pt-1 pb-0.5 text-left font-mono text-[0.65rem] font-semibold tracking-[0.1em] uppercase transition-colors";

export function SidebarNav({
  section = "operations",
  collapsed = false,
  onNavigate,
}: {
  section?: AdminSection;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const overridesRaw = useSyncExternalStore(
    subscribeOpen,
    readOpenRaw,
    () => "",
  );
  const overrides = parseOverrides(overridesRaw);
  const { prefs } = useAdminPrefs();
  const groups = NAV_SECTIONS[section].groups;
  const active = activeItemFor(pathname);

  // Navigating INTO a group re-opens it (and "More", when the group lives
  // there) even if the admin collapsed it earlier, so the current page is
  // never hidden inside a closed group. An explicit collapse still holds while
  // they stay on pages of that group. (Writes only to localStorage + the
  // change event; no React state is set here.)
  useEffect(() => {
    if (!active) return;
    const owner = groups.find((g) => g.items.some((it) => it.id === active.id));
    if (!owner) return;
    const current = parseOverrides(readOpenRaw());
    const next = { ...current };
    let changed = false;
    if (owner.label && current[owner.label] === false) {
      delete next[owner.label];
      changed = true;
    }
    if (owner.secondary && current[MORE_KEY] === false) {
      delete next[MORE_KEY];
      changed = true;
    }
    if (changed) writeOverrides(next);
  }, [active, groups]);

  const favSet = new Set(prefs.favourites);
  const favourites = prefs.favourites
    .map((id) => NAV_BY_ID.get(id))
    .filter((it): it is NavItem => Boolean(it));
  const recents = prefs.recents
    .map((r) => NAV_BY_ID.get(r.id))
    .filter(
      (it): it is NavItem =>
        Boolean(it) &&
        !favSet.has(it!.id) &&
        it!.id !== active?.id &&
        it!.id !== "dashboard",
    )
    .slice(0, 5);

  const primary = groups.filter((g) => !g.secondary);
  // Unlabelled entries (Dashboard / Documents) stay pinned to the very top;
  // the admin's Favourites and Recent shortcuts follow, then the groups.
  const leading = primary.filter((g) => !g.label);
  const labelled = primary.filter((g) => g.label);
  const secondary = groups.filter((g) => g.secondary);
  const moreContainsActive = secondary.some((g) =>
    g.items.some((it) => it.id === active?.id),
  );
  const moreOpen = overrides[MORE_KEY] ?? moreContainsActive;

  const renderGroup = (group: NavGroup, gi: number) => {
    const containsActive = group.items.some((it) => it.id === active?.id);
    // Unlabeled groups (Dashboard / Documents) are always visible.
    const open = !group.label
      ? true
      : (overrides[group.label] ?? containsActive);

    return (
      <div key={group.label ?? gi} className="flex flex-col gap-px">
        {group.label &&
          (collapsed ? (
            gi > 0 && (
              <div className="bg-sidebar-border mx-auto my-1 h-px w-5" />
            )
          ) : (
            <button
              type="button"
              onClick={() => setOverride(group.label!, !open)}
              aria-expanded={open}
              className={cn(
                HEAD_CLASS,
                containsActive && !open
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}
            >
              <span>{group.label}</span>
              <ChevronDown
                size={12}
                aria-hidden
                className={cn(
                  "shrink-0 opacity-50 transition-transform duration-200 group-hover/head:opacity-80",
                  open ? "rotate-0" : "-rotate-90",
                )}
              />
            </button>
          ))}

        {/* Collapsed rail always lists items; expanded rail animates the
            group body via the grid 0fr↔1fr technique. */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
          style={{
            gridTemplateRows: collapsed || open ? "1fr" : "0fr",
          }}
        >
          <div className="flex min-h-0 flex-col gap-px overflow-hidden">
            {group.items.map((item) => (
              <NavLink
                key={item.id}
                item={item}
                active={item.id === active?.id}
                collapsed={collapsed}
                tabbable={collapsed || open}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <nav className="flex flex-col gap-3 px-2 py-2.5">
      {leading.map(renderGroup)}

      {favourites.length > 0 && (
        <Shortcuts
          label="Favourites"
          icon={Star}
          items={favourites}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      )}
      {recents.length > 0 && (
        <Shortcuts
          label="Recent"
          icon={Clock}
          items={recents}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      )}

      {labelled.map((g, i) => renderGroup(g, i + leading.length))}

      {secondary.length > 0 && (
        <div className="flex flex-col gap-px">
          {collapsed ? (
            <div className="bg-sidebar-border mx-auto my-1 h-px w-5" />
          ) : (
            <button
              type="button"
              onClick={() => setOverride(MORE_KEY, !moreOpen)}
              aria-expanded={moreOpen}
              className={cn(
                HEAD_CLASS,
                moreContainsActive && !moreOpen
                  ? "text-sidebar-primary"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
              )}
            >
              <span>More</span>
              <ChevronDown
                size={12}
                aria-hidden
                className={cn(
                  "shrink-0 opacity-50 transition-transform duration-200 group-hover/head:opacity-80",
                  moreOpen ? "rotate-0" : "-rotate-90",
                )}
              />
            </button>
          )}
          <div
            className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
            style={{
              gridTemplateRows: collapsed || moreOpen ? "1fr" : "0fr",
            }}
          >
            <div className="flex min-h-0 flex-col gap-3 overflow-hidden pt-1">
              {secondary.map((g, i) => renderGroup(g, primary.length + i))}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/** Favourites / Recent: plain shortcut links (no active styling — the page's
 *  own group already highlights it, and the active indicator's shared layoutId
 *  must exist exactly once). */
function Shortcuts({
  label,
  icon: Icon,
  items,
  collapsed,
  onNavigate,
}: {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex flex-col gap-px">
      {collapsed ? (
        <div className="bg-sidebar-border mx-auto my-1 h-px w-5" />
      ) : (
        <div
          className={cn(
            HEAD_CLASS,
            "text-sidebar-foreground/70 cursor-default",
          )}
        >
          <span className="flex items-center gap-1.5">
            <Icon size={11} aria-hidden className="opacity-70" />
            {label}
          </span>
        </div>
      )}
      {items.map((item) => (
        <NavLink
          key={`${label}-${item.id}`}
          item={item}
          active={false}
          collapsed={collapsed}
          tabbable
          onNavigate={onNavigate}
          star={label === "Favourites"}
          shortcut
        />
      ))}
    </div>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  tabbable,
  onNavigate,
  star = true,
  shortcut = false,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  tabbable: boolean;
  onNavigate?: () => void;
  /** Show the favourite toggle (hidden on the collapsed rail). */
  star?: boolean;
  /** Rendered inside Favourites/Recent: show the unique title on hover. */
  shortcut?: boolean;
}) {
  const { isFavourite, toggleFavourite } = useAdminPrefs();
  const fav = isFavourite(item.id);
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      tabIndex={tabbable ? undefined : -1}
      title={shortcut ? item.title : undefined}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors duration-150",
        collapsed ? "justify-center px-0" : star && "pr-7",
        active
          ? "text-sidebar-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="admin-nav-indicator"
          className="bg-sidebar-accent absolute inset-0 -z-10 rounded-md"
          transition={{ type: "spring", stiffness: 520, damping: 40 }}
        />
      )}
      <Icon
        size={16}
        strokeWidth={2}
        aria-hidden
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-sidebar-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed && (
        <span className="truncate">{shortcut ? item.title : item.label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  // The star is a sibling of the link (a button inside an anchor is invalid
  // HTML); it only appears on hover/focus unless the item is already pinned.
  return (
    <div className="group/row relative">
      {link}
      {star && (
        <button
          type="button"
          aria-label={
            fav
              ? `Remove ${item.title} from favourites`
              : `Add ${item.title} to favourites`
          }
          aria-pressed={fav}
          tabIndex={tabbable ? undefined : -1}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleFavourite(item.id);
          }}
          className={cn(
            "absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded transition-opacity",
            fav
              ? "text-sidebar-primary opacity-100"
              : "text-muted-foreground hover:text-foreground opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100",
          )}
        >
          <Star
            size={12}
            aria-hidden
            fill={fav ? "currentColor" : "none"}
            strokeWidth={2}
          />
        </button>
      )}
    </div>
  );
}

export type { NavGroup };
