"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SortDir } from "@/lib/admin/list-params";
import { useListParams } from "./use-list-params";

/**
 * Clickable column header for sortable DataTable columns. The first click
 * sorts by this key in its default direction; a click on the active column
 * flips the direction. The active state comes from the server-resolved sort
 * (passed down by DataTable), never from parsing the URL twice.
 */
export function SortHeader({
  sortKey,
  label,
  defaultDir = "desc",
  active,
  dir,
  align = "left",
}: {
  sortKey: string;
  label: React.ReactNode;
  defaultDir?: SortDir;
  active: boolean;
  dir: SortDir;
  align?: "left" | "right" | "center";
}) {
  const { set } = useListParams();
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() =>
        set({
          sort: sortKey,
          dir: active ? (dir === "asc" ? "desc" : "asc") : defaultDir,
        })
      }
      className={cn(
        "hover:text-foreground -mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors",
        align === "right" && "flex-row-reverse",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      title={
        active
          ? `Sorted ${dir === "asc" ? "ascending" : "descending"} — click to flip`
          : "Sort by this column"
      }
    >
      <span>{label}</span>
      <Icon
        size={13}
        aria-hidden
        className={cn("shrink-0", !active && "opacity-50")}
      />
    </button>
  );
}
