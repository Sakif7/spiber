"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Search,
  CornerDownLeft,
  Loader2,
  ShoppingCart,
  FileText,
  Package,
  User,
  ShoppingBag,
  ClipboardList,
  CalendarClock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import type {
  AdminSearchGroupKey,
  AdminSearchHit,
  AdminSearchResponse,
} from "@/lib/search/admin-dto";
import {
  NAV_BY_ID,
  NAV_ITEMS_FLAT,
  NAV_SECTIONS,
  navContextFor,
  navGroupsFor,
  sectionsFor,
  type AdminSection,
  type NavItem,
  type NavViewer,
} from "./nav";
import { useAdminPrefs } from "./admin-prefs";

type PageEntry = { kind: "page"; key: string; item: NavItem; caption: string };
type RecordEntry = { kind: "record"; key: string; hit: AdminSearchHit };
type Entry = PageEntry | RecordEntry;
type Section = { label: string; entries: Entry[] };

const GROUP_ICON: Record<AdminSearchGroupKey, LucideIcon> = {
  orders: ShoppingCart,
  quotations: FileText,
  products: Package,
  customers: User,
  sellers: ShoppingBag,
  cases: ClipboardList,
  appointments: CalendarClock,
};

function captionFor(item: NavItem): string {
  const ctx = navContextFor(item.id);
  return [ctx ? NAV_SECTIONS[ctx.section].label : null, ctx?.group]
    .filter(Boolean)
    .join(" ·");
}

const PAGE_ENTRIES: PageEntry[] = NAV_ITEMS_FLAT.map((item) => ({
  kind: "page",
  key: `page:${item.id}`,
  item,
  caption: captionFor(item),
}));

/** The pages this viewer may open: a plain admin loses the super-admin-only
 *  ones, an employee sees only their portal. Same filter as the sidebar. */
function pageEntriesFor(viewer: NavViewer): PageEntry[] {
  const allowed = new Set(
    sectionsFor(viewer)
      .flatMap((s) => navGroupsFor(s, viewer))
      .flatMap((g) => g.items.map((it) => it.id)),
  );
  return PAGE_ENTRIES.filter((e) => allowed.has(e.item.id));
}

function pageMatches(e: PageEntry, terms: string[]): boolean {
  const hay = `${e.item.title} ${e.item.label} ${e.caption}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/**
 * Ctrl+K palette. With an empty query it lists the admin's recent pages and
 * every admin page; with two or more characters it ALSO searches records
 * (orders, quotations, products, customers, sellers, cases, appointments)
 * through GET /api/admin/search — debounced, with the previous request
 * aborted — and lists those groups first. Pages stay a substring filter
 * (~45 destinations don't need fuzzy ranking).
 */
export function CommandPalette({
  open,
  onOpenChange,
  viewer,
  section = "operations",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: NavViewer;
  /** Recent pages are hidden in the Company section (see SidebarNav). */
  section?: AdminSection;
}) {
  const router = useRouter();
  const { prefs } = useAdminPrefs();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [records, setRecords] = useState<AdminSearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const trimmed = query.trim();
  const terms = trimmed.toLowerCase().split(/\s+/).filter(Boolean);

  const fetchRecords = useDebouncedCallback((q: string) => {
    abortRef.current?.abort();
    // Record search is an admin API; an employee's palette is pages only.
    if (q.length < 2 || !viewer.isAdmin) {
      setRecords(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((json) => {
        if (ctrl.signal.aborted) return;
        const data = (json?.data ?? json) as AdminSearchResponse | undefined;
        if (data && typeof data.query === "string") setRecords(data);
      })
      .catch(() => {})
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, 180);

  // Build the visible sections.
  const pageEntries = pageEntriesFor(viewer);
  const pageIds = new Set(pageEntries.map((e) => e.item.id));
  const sections: Section[] = [];
  if (terms.length === 0 && section !== "company") {
    const recent = prefs.recents
      .map((r) => NAV_BY_ID.get(r.id))
      .filter(
        (it): it is NavItem =>
          Boolean(it) && it!.id !== "dashboard" && pageIds.has(it!.id),
      )
      .slice(0, 5);
    if (recent.length > 0) {
      sections.push({
        label: "Recent",
        entries: recent.map((item) => ({
          kind: "page",
          key: `recent:${item.id}`,
          item,
          caption: captionFor(item),
        })),
      });
    }
    sections.push({ label: "Pages", entries: pageEntries });
  } else if (terms.length === 0) {
    sections.push({ label: "Pages", entries: pageEntries });
  } else {
    if (records && records.query === trimmed) {
      for (const g of records.groups) {
        sections.push({
          label: g.label,
          entries: g.hits.map((hit) => ({
            kind: "record",
            key: `rec:${g.key}:${hit.id}`,
            hit,
          })),
        });
      }
    }
    const pages = pageEntries.filter((e) => pageMatches(e, terms));
    if (pages.length > 0) sections.push({ label: "Pages", entries: pages });
  }
  const flat = sections.flatMap((s) => s.entries);

  // Reset the highlight when the query changes (adjust-during-render pattern).
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setIndex(0);
  }
  const selected = Math.min(index, Math.max(0, flat.length - 1));

  // Keep the highlighted row visible while arrowing (DOM-only effect).
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function reset() {
    fetchRecords.cancel();
    abortRef.current?.abort();
    setQuery("");
    setRecords(null);
    setLoading(false);
  }

  function go(entry: Entry) {
    onOpenChange(false);
    reset();
    router.push(entry.kind === "page" ? entry.item.href : entry.hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex(Math.min(selected + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex(Math.max(selected - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = flat[selected];
      if (entry) go(entry);
    }
  }

  const searching = terms.length > 0 && trimmed.length >= 2;
  const noMatches = terms.length > 0 && flat.length === 0 && !loading;

  let flatIndex = -1;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent
        className="top-20 max-w-xl translate-y-0 gap-0 overflow-hidden p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          Search records and admin pages
        </DialogTitle>
        <div className="border-border flex items-center gap-2 border-b px-3">
          {loading ? (
            <Loader2
              className="text-muted-foreground size-4 shrink-0 animate-spin"
              aria-hidden
            />
          ) : (
            <Search
              className="text-muted-foreground size-4 shrink-0"
              aria-hidden
            />
          )}
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              fetchRecords(e.target.value.trim());
            }}
            onKeyDown={onKeyDown}
            placeholder="Search orders, products, customers, cases… or jump to a page"
            aria-label="Search records and admin pages"
            role="combobox"
            aria-expanded
            aria-controls="admin-palette-list"
            aria-activedescendant={
              flat[selected] ? `palette-opt-${selected}` : undefined
            }
            className="text-foreground placeholder:text-muted-foreground h-11 w-full bg-transparent text-sm outline-none"
          />
          <kbd
            aria-hidden
            className="text-muted-foreground border-border rounded border px-1.5 py-0.5 font-mono text-[0.625rem]"
          >
            esc
          </kbd>
        </div>
        <div
          ref={listRef}
          id="admin-palette-list"
          role="listbox"
          className="max-h-[min(64vh,26rem)] overflow-y-auto overscroll-contain p-1.5"
        >
          {noMatches && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              No matches for &ldquo;{trimmed}&rdquo;
            </p>
          )}
          {searching && loading && flat.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              Searching…
            </p>
          )}
          {sections.map((section) => (
            <div key={section.label} role="group" aria-label={section.label}>
              <div className="text-muted-foreground px-2.5 pt-2 pb-1 font-mono text-[0.625rem] font-semibold tracking-[0.12em] uppercase">
                {section.label}
              </div>
              {section.entries.map((entry) => {
                flatIndex += 1;
                const i = flatIndex;
                const isSelected = i === selected;
                const Icon =
                  entry.kind === "page"
                    ? entry.item.icon
                    : GROUP_ICON[entry.hit.group];
                return (
                  <button
                    key={entry.key}
                    type="button"
                    id={`palette-opt-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => go(entry)}
                    onMouseMove={() => setIndex(i)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left",
                      isSelected
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground",
                    )}
                  >
                    <Icon
                      size={15}
                      strokeWidth={2}
                      aria-hidden
                      className="text-muted-foreground shrink-0"
                    />
                    {entry.kind === "page" ? (
                      <>
                        <span className="truncate">{entry.item.title}</span>
                        <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1.5 text-xs">
                          {entry.caption}
                          {isSelected && (
                            <CornerDownLeft
                              size={12}
                              aria-hidden
                              className="opacity-60"
                            />
                          )}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-medium">
                            {entry.hit.title}
                          </span>
                          {entry.hit.subtitle && (
                            <span className="text-muted-foreground truncate text-xs">
                              {entry.hit.subtitle}
                            </span>
                          )}
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-1.5">
                          {entry.hit.badge && (
                            <StatusBadge dot={false}>
                              {entry.hit.badge}
                            </StatusBadge>
                          )}
                          {isSelected && (
                            <CornerDownLeft
                              size={12}
                              aria-hidden
                              className="text-muted-foreground opacity-60"
                            />
                          )}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
