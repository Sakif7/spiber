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
import { EmptyState } from "./empty-state";

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
};

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Generic admin table: a bordered card wrapping a shadcn table, with a built-in
 * branded empty state. Rows are rendered through per-column `cell` functions so
 * each page keeps full control of its cells (links, badges, actions).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowClassName,
  empty,
  emptyIcon,
  emptyDescription,
  minWidth = 640,
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  /** Optional per-row class (e.g. a selected-row tint). */
  rowClassName?: (row: T, index: number) => string | undefined;
  empty: string;
  emptyIcon?: LucideIcon;
  emptyDescription?: string;
  minWidth?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card overflow-hidden rounded-xl shadow-[var(--shadow-sm)]",
        className,
      )}
    >
      {rows.length === 0 ? (
        <EmptyState
          icon={emptyIcon}
          title={empty}
          description={emptyDescription}
        />
      ) : (
        <Table style={{ minWidth }}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "text-muted-foreground h-11 px-4 text-sm font-semibold",
                    alignClass[c.align ?? "left"],
                    c.headClassName,
                  )}
                >
                  {c.header}
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
                    className={cn(
                      "px-4 py-3 align-middle",
                      alignClass[c.align ?? "left"],
                      c.className,
                    )}
                  >
                    {c.cell(row, i)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
