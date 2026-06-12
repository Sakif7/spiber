"use client";

import { usePathname, Link } from "@/i18n/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { NAV_GROUPS, isNavItemActive } from "./nav";

/**
 * The admin navigation tree. Shared by the desktop sidebar and the mobile
 * drawer. When `collapsed`, items render icon-only with a tooltip label and a
 * sliding active indicator (shared-layout, spring) glides between routes.
 */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-3">
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label ?? gi} className="flex flex-col gap-0.5">
          {group.label &&
            (collapsed ? (
              gi > 0 && (
                <div className="bg-sidebar-border mx-auto mb-1 h-px w-6" />
              )
            ) : (
              <p className="text-muted-foreground/70 px-2.5 pb-1 font-mono text-[0.625rem] font-medium tracking-[0.14em] uppercase">
                {group.label}
              </p>
            ))}

          {group.items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            const link = (
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
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
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : (
              <div key={item.href}>{link}</div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
