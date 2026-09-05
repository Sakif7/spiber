"use client";

import { useMemo, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import type { SortDir } from "@/lib/admin/list-params";
import { formatApiError } from "@/lib/http/form-error";
import { cn } from "@/lib/cn";

export type ProductManagerRow = {
  id: string;
  name: string;
  sku: string;
  priceLabel: string;
  stock: number;
  lowStock: boolean;
  status: string;
  featured: boolean;
};

type Storefront = "instruments" | "marketplace";

type Action = "activate" | "draft" | "archive" | "delete";

const ACTIONS: { key: Action; label: string; danger?: boolean }[] = [
  { key: "activate", label: "Set active" },
  { key: "draft", label: "Set draft" },
  { key: "archive", label: "Archive" },
  { key: "delete", label: "Delete", danger: true },
];

const PAST: Record<Action, string> = {
  activate: "Activated",
  draft: "Set to draft",
  archive: "Archived",
  delete: "Deleted",
};

/**
 * Product list for one storefront: the shared list kit (search, status
 * filter, sort, paging — all URL state) plus row selection and bulk actions.
 * The page parses the URL and loads rows; this component only owns the
 * transient selection and the bulk request.
 */
export function ProductsManager({
  storefront,
  title,
  description,
  basePath,
  newHref,
  rows,
  total,
  page,
  pages,
  pageSize,
  q,
  status,
  sort = { key: "date", dir: "desc" },
}: {
  storefront: Storefront;
  title: string;
  description?: string;
  basePath: string;
  newHref: string;
  rows: ProductManagerRow[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
  q: string;
  status: string;
  sort: { key: string; dir: SortDir };
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset the transient selection when the filter/page actually changes —
  // React's "adjust state during render on prop change" pattern: no effect,
  // no remount (a remount would drop the search input's focus).
  const navKey = `${q}|${status}|${page}|${sort.key}|${sort.dir}`;
  const [prevNavKey, setPrevNavKey] = useState(navKey);
  if (navKey !== prevNavKey) {
    setPrevNavKey(navKey);
    if (selected.size > 0) setSelected(new Set());
    if (allMatching) setAllMatching(false);
  }

  const allOnPage = rows.length > 0 && selected.size === rows.length;
  const selectedCount = allMatching ? total : selected.size;
  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  function toggleAllOnPage(checked: boolean) {
    setAllMatching(false);
    setSelected(checked ? new Set(pageIds) : new Set());
  }
  function toggleOne(id: string, checked: boolean) {
    setAllMatching(false);
    setSelected((prev) => {
      const n = new Set(prev);
      if (checked) n.add(id);
      else n.delete(id);
      return n;
    });
  }
  function clearSelection() {
    setSelected(new Set());
    setAllMatching(false);
  }

  async function runBulk(action: Action) {
    if (selectedCount === 0 || busy) return;
    if (action === "delete" || action === "archive") {
      const verb = action === "delete" ? "Delete" : "Archive";
      if (
        !window.confirm(
          `${verb} ${selectedCount} product${selectedCount === 1 ? "" : "s"}?` +
            (action === "delete"
              ? " They'll be archived and hidden from the storefront."
              : ""),
        )
      )
        return;
    }
    setBusy(true);
    try {
      const body = allMatching
        ? {
            action,
            storefront,
            all: true,
            status: status || undefined,
            search: q || undefined,
          }
        : { action, storefront, ids: [...selected] };
      const res = await fetch("/api/admin/products/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        toast.error(formatApiError(json));
        return;
      }
      const { modified, skipped } = json.data as {
        modified: number;
        skipped: number;
      };
      toast.success(
        `${PAST[action]} ${modified} product${modified === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} skipped (needs a price)` : ""),
      );
      clearSelection();
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const columns: Column<ProductManagerRow>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          aria-label="Select all on page"
          className="size-4 cursor-pointer accent-[var(--color-brand)]"
          checked={allOnPage}
          onChange={(e) => toggleAllOnPage(e.target.checked)}
        />
      ),
      headClassName: "w-9",
      className: "w-9",
      mobile: "hidden",
      cell: (p) => (
        <input
          type="checkbox"
          aria-label={`Select ${p.name}`}
          className="size-4 cursor-pointer accent-[var(--color-brand)]"
          checked={allMatching || selected.has(p.id)}
          disabled={allMatching}
          onChange={(e) => toggleOne(p.id, e.target.checked)}
        />
      ),
    },
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      sortDir: "asc",
      mobile: "primary",
      cell: (p) => (
        <span className="flex items-center gap-2">
          <Link
            href={`${basePath}/${p.id}`}
            className="text-primary font-medium hover:underline"
          >
            {p.name || "(untitled)"}
          </Link>
          {p.featured && (
            <span className="text-[10px] font-bold tracking-wide text-[var(--color-secondary-deep)]">
              ★ FEATURED
            </span>
          )}
        </span>
      ),
    },
    {
      key: "sku",
      header: "SKU",
      className: "font-mono text-xs text-muted-foreground",
      mobile: "meta",
      cell: (p) => p.sku,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortKey: "price",
      className: "whitespace-nowrap",
      mobile: "meta",
      cell: (p) => p.priceLabel,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      mobile: "meta",
      cell: (p) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            p.lowStock && "font-bold text-[var(--color-error)]",
          )}
        >
          {p.stock}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "w-10",
      mobile: "actions",
      cell: (p) => (
        <RowActions
          label={`Actions for ${p.name}`}
          actions={[
            {
              label: "Edit product",
              href: `${basePath}/${p.id}`,
              icon: "edit",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title={title}
        description={description}
        action={
          <Button asChild size="sm">
            <Link href={newHref}>New product</Link>
          </Button>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search name or SKU…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: [
              { value: "draft", label: "Draft" },
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
            ],
          },
        ]}
        sort={{
          options: [
            { value: "date", label: "Newest" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "price", label: "Price" },
          ],
        }}
        currentSort={sort}
        total={total}
        countLabel={`${total} product${total === 1 ? "" : "s"}`}
      />

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-brand-soft)] px-3 py-2">
          <strong className="mr-1 text-[13px]">{selectedCount} selected</strong>
          {ACTIONS.map((a) => (
            <Button
              key={a.key}
              type="button"
              size="sm"
              variant={a.danger ? "destructive" : "secondary"}
              disabled={busy}
              onClick={() => runBulk(a.key)}
            >
              {a.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="ml-auto"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      )}

      {/* "Select all matching" banner */}
      {allOnPage && !allMatching && total > rows.length && (
        <p className="text-muted-foreground text-center text-[13px]">
          All {rows.length} on this page selected.{" "}
          <button
            type="button"
            onClick={() => setAllMatching(true)}
            className="text-primary font-semibold underline"
          >
            Select all {total} matching this filter
          </button>
        </p>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => p.id}
        sort={sort}
        rowClassName={(p) =>
          allMatching || selected.has(p.id)
            ? "bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand-soft)]"
            : undefined
        }
        empty={
          q || status ? "No products match these filters." : "No products yet."
        }
        emptyDescription={
          q || status
            ? "Try clearing the search or the status filter."
            : "Create the first product with the New product button."
        }
        emptyAction={
          !q && !status ? (
            <Button asChild size="sm">
              <Link href={newHref}>New product</Link>
            </Button>
          ) : undefined
        }
        emptyIcon={Package}
        minWidth={760}
      />

      <Pagination
        page={page}
        pages={pages}
        total={total}
        pageSize={pageSize}
        noun="products"
      />
    </div>
  );
}
