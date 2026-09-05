"use client";

import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { PAGE_SIZES } from "@/lib/admin/list-params";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useListParams } from "./use-list-params";
import { pageWindow } from "@/lib/admin/page-window";

/**
 * List-kit pagination footer: "Showing x–y of N", a page-size select, and a
 * windowed page navigator. Page changes push a history entry (back returns to
 * the previous page) and scroll to the top; the page size resets to page 1.
 */
export function Pagination({
  page,
  pages,
  total,
  pageSize,
  pageSizes = PAGE_SIZES,
  noun = "results",
  className,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  pageSizes?: readonly number[];
  /** Plural noun for the caption, e.g. "orders". */
  noun?: string;
  className?: string;
}) {
  const { set, pending } = useListParams();
  if (total <= 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div
      className={cn(
        "text-muted-foreground flex flex-col gap-3 text-xs sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Showing {from}–{to} of {total} {noun}
        </span>
        <Select
          value={String(pageSize)}
          onValueChange={(v) => set({ size: v })}
        >
          <SelectTrigger
            size="sm"
            className="h-7 w-auto gap-1 text-xs"
            aria-label="Rows per page"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} per page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pending && <Loader2 size={13} aria-hidden className="animate-spin" />}
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={page <= 1}
            aria-label="Previous page"
            onClick={() =>
              set({ page: String(page - 1) }, { resetPage: false, push: true })
            }
          >
            <ChevronLeft className="size-3.5" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
          {pageWindow(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`gap-${i}`} className="px-1" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={n}
                type="button"
                variant={n === page ? "default" : "ghost"}
                size="sm"
                className="h-7 min-w-7 px-2 tabular-nums"
                aria-current={n === page ? "page" : undefined}
                aria-label={`Page ${n}`}
                onClick={() =>
                  set({ page: String(n) }, { resetPage: false, push: true })
                }
              >
                {n}
              </Button>
            ),
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={page >= pages}
            aria-label="Next page"
            onClick={() =>
              set({ page: String(page + 1) }, { resetPage: false, push: true })
            }
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="size-3.5" />
          </Button>
        </nav>
      )}
    </div>
  );
}
