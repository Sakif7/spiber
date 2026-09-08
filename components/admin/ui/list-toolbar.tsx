"use client";

import { ArrowDown, ArrowUp, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SortDir } from "@/lib/admin/list-params";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListSearch } from "./list-search";
import { useListParams } from "./use-list-params";
import { TogglePill } from "@/components/admin/ui/segmented";

export type FilterOption = { value: string; label: string; count?: number };
export type FilterDef = {
  /** URL param the filter writes (e.g. "status", "store", "assignee"). */
  param: string;
  label: string;
  options: FilterOption[];
  /** Caption of the"everything" choice. */
  allLabel?: string;
  /** Pills for short lists, a select for long ones (auto: >6 → select). */
  kind?: "pills" | "select";
};
export type SortOption = {
  value: string;
  label: string;
  /** Direction used when this option is first picked. */
  defaultDir?: SortDir;
};

const ALL = "__all";

/**
 * The shared admin list toolbar. Every control writes URL params through
 * `useListParams`, so the server page re-renders the list from the URL and
 * the controls simply reflect it: search (`q`), filters (their own params),
 * an optional date range (`from`/`to`), the sort key/direction (`sort`/`dir`)
 * and the result count. Active search/filters render as removable chips with
 * a Reset. Put page actions (export,"New X") in `children` — they sit on the
 * right of the first row.
 */
export function ListToolbar({
  search,
  filters = [],
  sort,
  currentSort,
  dateRange = false,
  total,
  countLabel,
  children,
  className,
}: {
  search?: { placeholder: string; ariaLabel?: string };
  filters?: FilterDef[];
  sort?: { options: SortOption[] };
  /** The resolved sort from the server (`parseListQuery`), so the control
   *  shows the default even when the URL carries no `sort`. */
  currentSort?: { key: string; dir: SortDir };
  dateRange?: boolean;
  total?: number;
  /** Pre-formatted count caption from the server, e.g."12 orders". */
  countLabel?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { searchParams, set, pending } = useListParams();

  const q = searchParams.get("q") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const activeFilters = filters
    .map((f) => {
      const value = searchParams.get(f.param) ?? "";
      if (!value) return null;
      const label = f.options.find((o) => o.value === value)?.label ?? value;
      return { def: f, value, label };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const anyActive = activeFilters.length > 0 || Boolean(q) || from || to;

  function reset() {
    const patch: Record<string, undefined> = {
      q: undefined,
      from: undefined,
      to: undefined,
    };
    for (const f of filters) patch[f.param] = undefined;
    set(patch);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <ListSearch
            placeholder={search.placeholder}
            ariaLabel={search.ariaLabel}
            className="w-full sm:w-64 lg:w-72"
          />
        )}

        {filters.map((f) => {
          const value = searchParams.get(f.param) ?? "";
          const asSelect =
            f.kind === "select" || (!f.kind && f.options.length > 6);
          return asSelect ? (
            <Select
              key={f.param}
              value={value || ALL}
              onValueChange={(v) =>
                set({ [f.param]: v === ALL ? undefined : v })
              }
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-auto min-w-36 gap-1.5"
                aria-label={f.label}
              >
                <span className="text-muted-foreground">{f.label}:</span>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{f.allLabel ?? "All"}</SelectItem>
                {f.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                    {typeof o.count === "number" ? ` (${o.count})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div
              key={f.param}
              role="group"
              aria-label={f.label}
              className="flex flex-wrap items-center gap-1"
            >
              <Pill
                active={!value}
                onClick={() => set({ [f.param]: undefined })}
              >
                {f.allLabel ?? "All"}
              </Pill>
              {f.options.map((o) => (
                <Pill
                  key={o.value}
                  active={value === o.value}
                  onClick={() =>
                    set({ [f.param]: value === o.value ? undefined : o.value })
                  }
                >
                  {o.label}
                  {typeof o.count === "number" && (
                    <span className="ml-1 tabular-nums opacity-70">
                      {o.count}
                    </span>
                  )}
                </Pill>
              ))}
            </div>
          );
        })}

        {dateRange && (
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Date range"
          >
            <Input
              type="date"
              value={from}
              max={to || undefined}
              aria-label="From date"
              onChange={(e) => set({ from: e.target.value || undefined })}
              className="h-8 w-[9.5rem]"
            />
            <span className="text-muted-foreground text-xs">to</span>
            <Input
              type="date"
              value={to}
              min={from || undefined}
              aria-label="To date"
              onChange={(e) => set({ to: e.target.value || undefined })}
              className="h-8 w-[9.5rem]"
            />
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {pending && (
            <Loader2
              size={14}
              aria-hidden
              className="text-muted-foreground animate-spin"
            />
          )}
          {typeof total === "number" && (
            <span
              className="text-muted-foreground text-xs whitespace-nowrap tabular-nums"
              aria-live="polite"
            >
              {countLabel ?? `${total} result${total === 1 ? "" : "s"}`}
            </span>
          )}
          {sort && sort.options.length > 0 && (
            <SortControl
              options={sort.options}
              current={currentSort}
              onChange={(key, dir) => set({ sort: key, dir })}
            />
          )}
          {children}
        </div>
      </div>

      {anyActive && (
        <div className="flex flex-wrap items-center gap-1.5">
          {q && (
            <Chip
              label={`Search: “${q}”`}
              onRemove={() => set({ q: undefined })}
            />
          )}
          {activeFilters.map((a) => (
            <Chip
              key={a.def.param}
              label={`${a.def.label}: ${a.label}`}
              onRemove={() => set({ [a.def.param]: undefined })}
            />
          ))}
          {(from || to) && (
            <Chip
              label={`Date: ${from || "…"} → ${to || "…"}`}
              onRemove={() => set({ from: undefined, to: undefined })}
            />
          )}
          <button
            type="button"
            onClick={reset}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
          >
            <RotateCcw size={11} aria-hidden />
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <TogglePill active={active} onClick={onClick} className="capitalize">
      {children}
    </TogglePill>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-muted text-foreground inline-flex items-center gap-1 rounded-full py-0.5 pr-1 pl-2.5 text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        className="text-muted-foreground hover:bg-background hover:text-foreground rounded-full p-0.5"
      >
        <X size={11} aria-hidden />
      </button>
    </span>
  );
}

function SortControl({
  options,
  current,
  onChange,
}: {
  options: SortOption[];
  current?: { key: string; dir: SortDir };
  onChange: (key: string, dir: SortDir) => void;
}) {
  const key = current?.key ?? options[0]?.value ?? "";
  const dir: SortDir = current?.dir ?? "desc";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="Sort">
      <Select
        value={key}
        onValueChange={(v) => {
          const opt = options.find((o) => o.value === v);
          onChange(v, opt?.defaultDir ?? "desc");
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-8 w-auto gap-1.5"
          aria-label="Sort by"
        >
          <span className="text-muted-foreground">Sort:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label={dir === "asc" ? "Sorted ascending" : "Sorted descending"}
        title={
          dir === "asc"
            ? "Ascending — click for descending"
            : "Descending — click for ascending"
        }
        onClick={() => onChange(key, dir === "asc" ? "desc" : "asc")}
      >
        {dir === "asc" ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
