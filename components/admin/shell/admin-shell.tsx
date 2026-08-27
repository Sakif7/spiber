"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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
import { SidebarNav } from "./sidebar-nav";
import { AdminUserMenu } from "./admin-user-menu";
import { CommandPalette } from "./command-palette";
import { NotificationBell } from "./notification-bell";
import {
  NAV_ITEMS_FLAT,
  NAV_SECTIONS,
  sectionForPath,
  stripLocalePrefix,
  type AdminSection,
} from "./nav";

const COLLAPSE_KEY = "spiber-admin-sidebar-collapsed";
const COLLAPSE_EVENT = "spiber-admin-sidebar";

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

function pageTitle(pathname: string): string {
  const path = stripLocalePrefix(pathname);
  let best = "";
  let label = "Admin";
  for (const it of NAV_ITEMS_FLAT) {
    if (
      (path === it.href || path.startsWith(`${it.href}/`)) &&
      it.href.length > best.length
    ) {
      best = it.href;
      label = it.label;
    }
  }
  return label;
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
        className={cn("w-auto object-contain", collapsed ? "h-6" : "h-9")}
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
    <div
      role="group"
      aria-label="Admin section"
      className={cn(
        "bg-muted flex shrink-0 items-center gap-0.5 rounded-full p-0.5",
        className,
      )}
    >
      {(Object.keys(NAV_SECTIONS) as AdminSection[]).map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={section === key}
          onClick={() => onSwitch(key)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            section === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {NAV_SECTIONS[key].label}
        </button>
      ))}
    </div>
  );
}

export function AdminShell({
  email,
  role,
  children,
}: {
  email: string;
  role?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme } = useAdminTheme();
  // Read the persisted collapse preference without a hydration mismatch or a
  // setState-in-effect (the SSR snapshot is always "expanded").
  const collapsed = useSyncExternalStore(
    subscribeCollapse,
    readCollapse,
    () => false,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // The active section is derived from the route — no separate state to drift.
  const section = sectionForPath(pathname);

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

  function toggleCollapsed() {
    const next = !readCollapse();
    localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
    window.dispatchEvent(new Event(COLLAPSE_EVENT));
  }

  function switchSection(target: AdminSection) {
    if (target !== section) router.push(NAV_SECTIONS[target].home);
    setMobileOpen(false);
  }

  const title = pageTitle(pathname);

  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={120}>
        <div className="bg-background text-foreground flex min-h-[100dvh]">
          {/* Desktop sidebar */}
          <motion.aside
            initial={false}
            animate={{ width: collapsed ? 76 : 256 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="border-sidebar-border bg-sidebar sticky top-0 hidden h-screen shrink-0 flex-col border-r lg:flex"
          >
            <div
              className={cn(
                "border-sidebar-border flex h-16 items-center justify-center border-b px-4",
                collapsed && "px-0",
              )}
            >
              <Brand collapsed={collapsed} />
            </div>
            <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <SidebarNav section={section} collapsed={collapsed} />
            </div>
            <div
              className={cn(
                "border-sidebar-border border-t p-2",
                collapsed && "flex justify-center",
              )}
            >
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "sm"}
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
            <header className="border-border bg-background/80 sticky top-0 z-20 flex h-16 items-center gap-2 border-b px-4 backdrop-blur-md sm:gap-3 sm:px-6">
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    aria-label="Open navigation"
                  >
                    <Menu className="size-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent
                  side="left"
                  className="border-sidebar-border bg-sidebar w-[min(20rem,86vw)] gap-0 p-0"
                >
                  <SheetTitle className="sr-only">Admin navigation</SheetTitle>
                  <div className="border-sidebar-border flex h-16 items-center justify-center border-b px-4">
                    <Brand collapsed={false} />
                  </div>
                  <div className="border-sidebar-border flex justify-center border-b px-4 py-2.5">
                    <SectionSwitcher
                      section={section}
                      onSwitch={switchSection}
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
                    <SidebarNav
                      section={section}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </div>
                </SheetContent>
              </Sheet>

              <div className="min-w-0 flex-1">
                <motion.h1
                  key={title}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-foreground truncate text-base font-semibold sm:text-lg"
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
                onClick={() => setPaletteOpen(true)}
                aria-label="Search admin pages (Ctrl+K)"
                className="text-muted-foreground hidden h-9 items-center gap-2 px-3 text-sm font-normal sm:flex"
              >
                <Search className="size-4" />
                <span className="hidden lg:inline">Search…</span>
                <kbd className="border-border bg-muted rounded border px-1.5 py-0.5 font-mono text-[0.625rem]">
                  Ctrl K
                </kbd>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPaletteOpen(true)}
                aria-label="Search admin pages"
                className="sm:hidden"
              >
                <Search className="size-5" />
              </Button>

              <NotificationBell />
              <ThemeToggle />
              <AdminUserMenu email={email} role={role} />
            </header>

            <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
        <Toaster position="top-right" theme={theme} richColors closeButton />
      </TooltipProvider>
    </MotionConfig>
  );
}
