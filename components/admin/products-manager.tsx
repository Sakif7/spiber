"use client";

import { useMemo, useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { formatApiError } from "@/lib/http/form-error";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
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

export function ProductsManager({
  storefront,
  title,
  basePath,
  newHref,
  rows,
  total,
  page,
  pages,
  q,
  status,
}: {
  storefront: Storefront;
  title: string;
  basePath: string;
  newHref: string;
  rows: ProductManagerRow[];
  total: number;
  page: number;
  pages: number;
  q: string;
  status: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(q);
  const [isSearching, startSearching] = useTransition();

  const allOnPage = rows.length > 0 && selected.size === rows.length;
  const selectedCount = allMatching ? total : selected.size;

  const pageIds = useMemo(() => rows.map((r) => r.id), [rows]);

  function navigate(
    next: { q?: string; status?: string; page?: number },
    opts: { replace?: boolean } = {},
  ) {
    const params = new URLSearchParams();
    const nq = next.q ?? q;
    const ns = next.status ?? status;
    const np = next.page ?? 1;
    if (nq) params.set("q", nq);
    if (ns) params.set("status", ns);
    if (np > 1) params.set("page", String(np));
    const qs = params.toString();
    const url = qs ? `${basePath}?${qs}` : basePath;
    if (opts.replace) router.replace(url);
    else router.push(url);
  }

  // Live search: navigate (replace, page 1) after the user pauses typing.
  const debouncedSearch = useDebouncedCallback((value: string) => {
    if (value.trim() === q) return;
    startSearching(() =>
      navigate({ q: value.trim(), page: 1 }, { replace: true }),
    );
  }, 350);

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
      cell: (p) => p.sku,
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      className: "whitespace-nowrap",
      cell: (p) => p.priceLabel,
    },
    {
      key: "stock",
      header: "Stock",
      align: "right",
      cell: (p) => (
        <span
          className={cn(
            "font-medium",
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
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
  ];

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title={title}
        description={`${total} ${total === 1 ? "product" : "products"}`}
        action={
          <Button asChild>
            <Link href={newHref}>New product</Link>
          </Button>
        }
      />

      {/* Toolbar: live search + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            debouncedSearch.cancel();
            startSearching(() =>
              navigate({ q: search.trim(), page: 1 }, { replace: true }),
            );
          }}
          className="relative flex min-w-[260px] flex-1 items-center"
        >
          <Input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              debouncedSearch(e.target.value);
            }}
            placeholder="Search name or SKU…"
            aria-label="Search products"
            className="pr-9"
          />
          {isSearching && (
            <Loader2 className="text-muted-foreground absolute right-3 size-4 animate-spin" />
          )}
        </form>
        <Select
          value={status || "all"}
          onValueChange={(v) =>
            navigate({ status: v === "all" ? "" : v, page: 1 })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--color-brand-soft)] px-4 py-3">
          <strong className="mr-1 text-sm">{selectedCount} selected</strong>
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
        <p className="text-muted-foreground text-center text-sm">
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
        rowClassName={(p) =>
          allMatching || selected.has(p.id)
            ? "bg-[var(--color-brand-soft)] hover:bg-[var(--color-brand-soft)]"
            : undefined
        }
        empty={q || status ? "No products match." : "No products yet."}
        emptyIcon={Package}
        minWidth={720}
      />

      {/* Pagination */}
      {pages > 1 && (
        <div className="text-muted-foreground flex items-center justify-center gap-4 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
          >
            ← Prev
          </Button>
          <span>
            Page {page} of {pages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => navigate({ page: page + 1 })}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
