"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Search, CornerDownLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { NAV_SECTIONS, type AdminSection, type NavItem } from "./nav";

type PaletteEntry = NavItem & { section: AdminSection; group?: string };

const ENTRIES: PaletteEntry[] = (
  Object.keys(NAV_SECTIONS) as AdminSection[]
).flatMap((section) =>
  NAV_SECTIONS[section].groups.flatMap((g) =>
    g.items.map((item) => ({ ...item, section, group: g.label })),
  ),
);

function matches(entry: PaletteEntry, terms: string[]): boolean {
  const hay =
    `${entry.label} ${entry.group ?? ""} ${NAV_SECTIONS[entry.section].label}`.toLowerCase();
  return terms.every((t) => hay.includes(t));
}

/**
 * Ctrl+K quick-jump palette over every admin page (both the Operations and
 * Company sections). Deliberately dependency-free: a Dialog + substring filter
 * — ~45 destinations don't need fuzzy ranking.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const results = terms.length
    ? ENTRIES.filter((e) => matches(e, terms))
    : ENTRIES;

  // Reset the highlight when the query changes (adjust-during-render pattern).
  const [lastQuery, setLastQuery] = useState(query);
  if (lastQuery !== query) {
    setLastQuery(query);
    setIndex(0);
  }
  const selected = Math.min(index, Math.max(0, results.length - 1));

  // Keep the highlighted row visible while arrowing (DOM-only effect).
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function go(entry: PaletteEntry) {
    onOpenChange(false);
    setQuery("");
    router.push(entry.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex(Math.min(selected + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex(Math.max(selected - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = results[selected];
      if (entry) go(entry);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <DialogContent
        className="top-24 max-w-lg translate-y-0 gap-0 overflow-hidden p-0"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">Jump to an admin page</DialogTitle>
        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search
            className="text-muted-foreground size-4 shrink-0"
            aria-hidden
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search admin pages…"
            aria-label="Search admin pages"
            role="combobox"
            aria-expanded
            aria-controls="admin-palette-list"
            aria-activedescendant={
              results[selected] ? `palette-opt-${selected}` : undefined
            }
            className="text-foreground placeholder:text-muted-foreground h-12 w-full bg-transparent text-sm outline-none"
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
          className="max-h-[min(60vh,22rem)] overflow-y-auto overscroll-contain p-1.5"
        >
          {results.length === 0 && (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">
              No pages match &ldquo;{query}&rdquo;
            </p>
          )}
          {results.map((entry, i) => {
            const Icon = entry.icon;
            return (
              <button
                key={`${entry.section}-${entry.href}-${entry.label}`}
                type="button"
                id={`palette-opt-${i}`}
                data-index={i}
                role="option"
                aria-selected={i === selected}
                onClick={() => go(entry)}
                onMouseMove={() => setIndex(i)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm",
                  i === selected
                    ? "bg-accent text-accent-foreground"
                    : "text-foreground",
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={2}
                  aria-hidden
                  className="text-muted-foreground shrink-0"
                />
                <span className="truncate">{entry.label}</span>
                <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-1.5 text-xs">
                  {[NAV_SECTIONS[entry.section].label, entry.group]
                    .filter(Boolean)
                    .join(" · ")}
                  {i === selected && (
                    <CornerDownLeft
                      size={12}
                      aria-hidden
                      className="opacity-60"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
