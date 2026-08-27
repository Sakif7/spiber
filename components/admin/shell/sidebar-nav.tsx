"use client";

import { useSyncExternalStore } from "react";
import { usePathname, Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  NAV_SECTIONS,
  isNavItemActive,
  type AdminSection,
  type NavGroup,
  type NavItem,
} from "./nav";

/**
 * The admin navigation tree. Shared by the desktop sidebar and the mobile
 * drawer. Labeled groups are collapsible (accordion): the group holding the
 * current page opens automatically, explicit open/close choices persist per
 * admin in localStorage. When `collapsed`, items render icon-only with a
 * tooltip label; accordions are meaningless at that width, so every item shows.
 */

const OPEN_KEY = "spiber-admin-nav-open";
const OPEN_EVENT = "spiber-admin-nav-open-changed";

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
function setOverride(label: string, open: boolean) {
  const next = { ...parseOverrides(readOpenRaw()), [label]: open };
  localStorage.setItem(OPEN_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(OPEN_EVENT));
}

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
  const groups = NAV_SECTIONS[section].groups;

  return (
    <nav className="flex flex-col gap-4 px-3 py-3">
      {groups.map((group, gi) => {
        const containsActive = group.items.some((it) =>
          isNavItemActive(pathname, it.href),
        );
        // Unlabeled groups (Dashboard / Documents) are always visible.
        const open = !group.label
          ? true
          : (overrides[group.label] ?? containsActive);

        return (
          <div key={group.label ?? gi} className="flex flex-col gap-0.5">
            {group.label &&
              (collapsed ? (
                gi > 0 && (
                  <div className="bg-sidebar-border mx-auto mb-1 h-px w-6" />
                )
              ) : (
                <button
                  type="button"
                  onClick={() => setOverride(group.label!, !open)}
                  aria-expanded={open}
                  className={cn(
                    "group/head flex items-center justify-between rounded-md px-2.5 pt-1 pb-1 text-left font-mono text-[0.6875rem] font-semibold tracking-[0.12em] uppercase transition-colors",
                    containsActive && !open
                      ? "text-sidebar-primary"
                      : "text-sidebar-foreground/75 hover:text-sidebar-foreground",
                  )}
                >
                  <span>{group.label}</span>
                  <ChevronDown
                    size={13}
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
              <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                {group.items.map((item) => (
                  <NavLink
                    key={item.href}
                    item={item}
                    active={isNavItemActive(pathname, item.href)}
                    collapsed={collapsed}
                    tabbable={collapsed || open}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function NavLink({
  item,
  active,
  collapsed,
  tabbable,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  tabbable: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      tabIndex={tabbable ? undefined : -1}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-150",
        collapsed && "justify-center px-0",
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
        size={17}
        strokeWidth={2}
        aria-hidden
        className={cn(
          "shrink-0 transition-colors",
          active
            ? "text-sidebar-primary"
            : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );

  return collapsed ? (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {item.label}
      </TooltipContent>
    </Tooltip>
  ) : (
    link
  );
}

export type { NavGroup };
