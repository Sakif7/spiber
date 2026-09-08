import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SortDir } from "@/lib/admin/list-params";
import { EmptyState } from "./empty-state";
import { SortHeader } from "./sort-header";

export type Column<T> = {
  /** Stable identifier for the column. */
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  /** Extra classes for the body cells in this column. */
  className?: string;
  /** Extra classes for the header cell. */
  headClassName?: string;
  cell: (row: T, index: number) => React.ReactNode;
  /**
   * Make the header clickable: sorts the list by this key through the URL
   * (`?sort=&dir=`). The page must declare the key in its `sortable` config
   * and pass the resolved sort to the table via `sort`.
   */
  sortKey?: string;
  /** Direction used when the column is first clicked (default"desc"). */
  sortDir?: SortDir;
  /**
   * Placement of this column in the MOBILE card layout (below `md`):
   * -"primary" — the card's title line (rendered prominently, no label)
   * -"meta"    — a labelled `header → value` row (default)
   * -"actions" — moved to the card's footer action row
   * -"hidden"  — omitted from the card
   * If NO column on the table sets `mobile`, a sensible default is inferred:
   * the first column becomes"primary", right-aligned columns become
   *"actions", and the rest are"meta".
   */
  mobile?: "primary" | "meta" | "actions" | "hidden";
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Generic admin table. On `md`+ it renders a shadcn table (the table carries
 * its own horizontal-scroll container, so a wide table never overflows the
 * page). Below `md` it reflows into a **stacked card layout** built from the
 * same `Column` metadata — one card per row, each column a labelled line —
 * because a horizontally-scrolling data table is a poor phone experience.
 * A branded empty state is shown at every width. Columns with a `sortKey`
 * get a clickable header when the page passes the resolved `sort`.
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowClassName,
  sort,
  empty,
  emptyIcon,
  emptyDescription,
  emptyAction,
  minWidth = 640,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Optional per-row class (e.g. a selected-row tint). */
  rowClassName?: (row: T, index: number) => string | undefined;
  /** The server-resolved sort (from `parseListQuery`) for sortable headers. */
  sort?: { key: string; dir: SortDir };
  empty: string;
  emptyIcon?: LucideIcon;
  emptyDescription?: string;
  /** e.g. a"New X" button — tells the admin how rows get created. */
  emptyAction?: React.ReactNode;
  minWidth?: number;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        className={cn("bg-card overflow-hidden rounded-md border", className)}
      >
        <EmptyState
          icon={emptyIcon}
          title={empty}
          description={emptyDescription}
          action={emptyAction}
        />
      </div>
    );
  }

  const hasHints = columns.some((c) => c.mobile);
  // Placement is per-COLUMN (same for every row): the first column is the card
  // title, right-aligned columns become the footer action row, the rest are
  // labelled meta lines — unless a column declares an explicit `mobile` hint.
  const placement = (c: Column<T>) =>
    c.mobile ??
    (hasHints
      ? "meta"
      : columns.indexOf(c) === 0
        ? "primary"
        : c.align === "right"
          ? "actions"
          : "meta");

  const headerContent = (c: Column<T>) =>
    c.sortKey && sort ? (
      <SortHeader
        sortKey={c.sortKey}
        label={c.header}
        defaultDir={c.sortDir}
        active={sort.key === c.sortKey}
        dir={sort.dir}
        align={c.align}
      />
    ) : (
      c.header
    );

  return (
    <>
      {/* Mobile (<md): stacked cards built from the column metadata. */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map((row, i) => {
          const primary = columns.filter((c) => placement(c) === "primary");
          const meta = columns.filter((c) => placement(c) === "meta");
          const actions = columns.filter((c) => placement(c) === "actions");
          return (
            <div
              key={getRowKey(row, i)}
              className={cn(
                "bg-card flex flex-col gap-3 rounded-md border p-3",
                rowClassName?.(row, i),
              )}
            >
              {primary.length > 0 && (
                <div className="flex flex-col gap-1">
                  {primary.map((c) => (
                    <div
                      key={c.key}
                      className="text-foreground min-w-0 text-sm font-semibold break-words"
                    >
                      {c.cell(row, i)}
                    </div>
                  ))}
                </div>
              )}
              {meta.length > 0 && (
                <dl className="flex flex-col gap-2 text-sm">
                  {meta.map((c) => (
                    <div
                      key={c.key}
                      className="flex items-start justify-between gap-3"
                    >
                      <dt className="text-muted-foreground max-w-[45%] shrink-0">
                        {c.header}
                      </dt>
                      <dd className="text-foreground min-w-0 text-right break-words">
                        {c.cell(row, i)}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              {actions.length > 0 && (
                <div className="border-border flex flex-wrap items-center gap-2 border-t pt-3">
                  {actions.map((c) => (
                    <div key={c.key} className="min-w-0">
                      {c.cell(row, i)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* md+ : the data table (its container scrolls if columns are wide). */}
      <div
        className={cn(
          "bg-card hidden overflow-hidden rounded-md border md:block",
          className,
        )}
      >
        <Table style={{ minWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  aria-sort={
                    c.sortKey && sort && sort.key === c.sortKey
                      ? sort.dir === "asc"
                        ? "ascending"
                        : "descending"
                      : undefined
                  }
                  className={cn(alignClass[c.align ?? "left"], c.headClassName)}
                >
                  {headerContent(c)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, i) => (
              <TableRow
                key={getRowKey(row, i)}
                className={cn("group", rowClassName?.(row, i))}
              >
                {columns.map((c) => (
                  <TableCell
                    key={c.key}
                    className={cn(alignClass[c.align ?? "left"], c.className)}
                  >
                    {c.cell(row, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
