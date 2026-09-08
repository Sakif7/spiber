"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import { usePathname, useRouter, Link } from "@/i18n/navigation";
import { motion, MotionConfig } from "framer-motion";
import { Menu, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/admin/theme/theme-toggle";
import { useAdminTheme } from "@/components/admin/theme/admin-theme-provider";
import type { AdminPrefs } from "@/lib/admin/prefs";
import { SidebarNav } from "./sidebar-nav";
import { AdminUserMenu } from "./admin-user-menu";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import { AdminPrefsProvider, useAdminPrefs } from "./admin-prefs";
import { Segmented } from "@/components/admin/ui/segmented";
import {
  NAV_SECTIONS,
  sectionHomeFor,
  activeItemFor,
  sectionForPath,
  type AdminSection,
} from "./nav";

const COLLAPSE_KEY = "spiber-admin-sidebar-collapsed";
const COLLAPSE_EVENT = "spiber-admin-sidebar";

/** Dense shell metrics (Slice 1 of the admin overhaul): 240px rail, 56px
 *  topbar, 8px radii for every shadcn primitive inside the admin. */
const RAIL_W = 240;
const RAIL_W_COLLAPSED = 56;

function subscribeCollapse(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readCollapse() {
  return (
    typeof window !== "undefined" && localStorage.getItem(COLLAPSE_KEY) === "1"
  );
}

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Spiber Med — go to site home"
      className="focus-visible:ring-ring/50 flex items-center rounded-md outline-none focus-visible:ring-[3px]"
    >
      {/* The site's actual wordmark logo. Its teal/orange brand colors read on
          both the light and dark sidebar (same asset the public header + dark
          footer use), so no theme-specific variant or filter is needed. */}
      <Image
        src="/spibermed-wordmark.png"
        alt="Spiber Med"
        width={932}
        height={355}
        priority
        className={cn("w-auto object-contain", collapsed ? "h-5" : "h-8")}
        style={{ maxWidth: "100%" }}
      />
    </Link>
  );
}

/** Operations ⇄ Company segmented switcher (the future HRM lives on the
 *  Company side — its modules will just add groups to that nav tree). */
function SectionSwitcher({
  section,
  onSwitch,
  className,
}: {
  section: AdminSection;
  onSwitch: (s: AdminSection) => void;
  className?: string;
}) {
  return (
    <Segmented
      value={section}
      onChange={onSwitch}
      label="Admin section"
      size="md"
      className={className}
      options={(Object.keys(NAV_SECTIONS) as AdminSection[]).map((key) => ({
        value: key,
        label: NAV_SECTIONS[key].label,
      }))}
    />
  );
}

export function AdminShell({
  email,
  role,
  initialPrefs,
  fontClassName,
  children,
}: {
  email: string;
  role?: string;
  /** Server-loaded favourites/recents (no flash of an empty sidebar block). */
  initialPrefs?: AdminPrefs;
  /** next/font variables for the admin typeface, set on the root element. */
  fontClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <AdminPrefsProvider initial={initialPrefs}>
      <ShellInner email={email} role={role} fontClassName={fontClassName}>
        {children}
      </ShellInner>
    </AdminPrefsProvider>
  );
}

function ShellInner({
  fontClassName,
  email,
  role,
  children,
}: {
  fontClassName?: string;
  email: string;
  role?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useAdminTheme();
  const { recordVisit } = useAdminPrefs();
  // Presentation only — every super-admin page and route re-checks server-side.
  const isSuperAdmin = role === "super_admin";
  // Read the persisted collapse preference without a hydration mismatch or a
  // setState-in-effect (the SSR snapshot is always"expanded").
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    readCollapse,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The active section is derived from the route — no separate state to drift.
  const section = sectionForPath(pathname);
  const active = activeItemFor(pathname);
  const title = active?.title ?? "Admin";

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Record the visited page for the sidebar's Recent block (once per page,
  // never the dashboard itself).
  const lastRecorded = useRef<string | null>(null);
  useEffect(() => {
    if (!active || active.id === "dashboard") return;
    if (lastRecorded.current === active.id) return;
    lastRecorded.current = active.id;
    recordVisit(active.id);
  }, [active, recordVisit]);

  function toggleCollapsed() {
    const next = !readCollapse();
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  function switchSection(target: AdminSection) {
    // Land on a page this admin can actually open: the Company section's home
    // is the super-admin-only vault.
    if (target !== section) {
      router.push(sectionHomeFor(target, isSuperAdmin));
    }
    setMobileOpen(false);
  }

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={120}>
        {/* `.admin-root` carries the admin's whole token scope — typeface,
            type scale, density, hairline colour, radius and primary — so no
            component needs to restate any of it. */}
        <div
          className={cn(
            "admin-root bg-background text-foreground flex min-h-[100dvh]",
            fontClassName,
          )}
        >
          {/* Desktop sidebar */}
          <motion.aside
            initial={false}
            animate={{ width: collapsed ? RAIL_W_COLLAPSED : RAIL_W }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="border-sidebar-border bg-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r lg:flex"
          >
            <div
              className={cn(
                "border-sidebar-border flex h-14 items-center justify-center border-b px-3",
                collapsed && "px-0",
              )}
            >
              <Brand collapsed={collapsed} />
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <SidebarNav
                section={section}
                collapsed={collapsed}
                isSuperAdmin={isSuperAdmin}
              />
            </div>
            <div
              className={cn(
                "border-sidebar-border border-t p-1.5",
                collapsed && "flex justify-center",
              )}
            >
              <Button
                variant="ghost"
                size={collapsed ? "icon-sm" : "sm"}
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  !collapsed && "w-full justify-start gap-2",
                )}
              >
                {collapsed ? (
                  <PanelLeftOpen className="size-4" />
                ) : (
                  <>
                    <PanelLeftClose className="size-4" />
                    Collapse
                  </>
                )}
              </Button>
            </div>
          </motion.aside>

          {/* Main column */}
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-border bg-background/85 sticky top-0 z-20 flex h-14 items-center gap-2 border-b px-3 backdrop-blur-md sm:px-5">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="border-sidebar-border bg-sidebar w-[min(18rem,86vw)] gap-0 p-0"
                >
                  <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                  <div className="border-sidebar-border flex h-14 items-center justify-center border-b px-4">
                    <Brand collapsed={false} />
                  </div>
                  <div className="border-sidebar-border flex justify-center border-b px-4 py-2">
                    <SectionSwitcher
                      section={section}
                      onSwitch={switchSection}
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                    <SidebarNav
                      section={section}
                      onNavigate={() => setMobileOpen(false)}
                      isSuperAdmin={isSuperAdmin}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <motion.h1
                  key={title}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="text-foreground truncate text-[15px] font-semibold"
                >
                  {title}
                </motion.h1>
              </div>

              <SectionSwitcher
                section={section}
                onSwitch={switchSection}
                className="hidden md:flex"
              />

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search records and admin pages (Ctrl+K)"
                className="text-muted-foreground hidden h-8 items-center gap-2 px-2.5 font-normal sm:flex lg:w-56 lg:justify-start"
              >
                <Search className="size-4" />
                <span className="hidden lg:inline">Search…</span>
                <kbd className="border-border bg-muted ml-auto rounded border px-1.5 py-0.5 font-mono text-[0.625rem]">
                  Ctrl K
                </kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search records and admin pages"
                className="sm:hidden"
              >
                <Search className="size-5" />
              </Button>

              <NotificationBell />
              <ThemeToggle />
              <AdminUserMenu email={email} role={role} />
            </header>

            <main className="flex-1 px-4 py-5 sm:px-5 lg:px-6">{children}</main>
          </div>
        </div>
        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          isSuperAdmin={isSuperAdmin}
          section={section}
        />
        <Toaster position="top-right" theme={theme} richColors closeButton />
      </TooltipProvider>
    </MotionConfig>
  );
}
