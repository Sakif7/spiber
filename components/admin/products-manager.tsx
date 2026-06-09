"use client";

import { useMemo, useState, useTransition } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { CtaButton } from "@/components/ui/cta-button";
import { formatApiError } from "@/lib/http/form-error";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";

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

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "var(--s-3) var(--s-4)",
  fontSize: "var(--fs-sm)",
  fontWeight: 600,
  color: "var(--color-text-muted)",
  borderBottom: "1px solid var(--color-border)",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "var(--s-3) var(--s-4)",
  fontSize: "var(--fs-sm)",
  color: "var(--color-text)",
  borderBottom: "1px solid var(--color-border)",
  verticalAlign: "middle",
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
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
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
    setMsg(null);
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
        setMsg({ kind: "err", text: formatApiError(json) });
        return;
      }
      const { modified, skipped } = json.data as {
        modified: number;
        skipped: number;
      };
      setMsg({
        kind: "ok",
        text:
          `${PAST[action]} ${modified} product${modified === 1 ? "" : "s"}` +
          (skipped > 0 ? ` · ${skipped} skipped (needs a price)` : ""),
      });
      clearSelection();
      router.refresh();
    } catch {
      setMsg({ kind: "err", text: "Something went wrong. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--s-5)" }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-4)",
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-2xl)",
            fontWeight: 700,
            color: "var(--color-text-strong)",
            margin: 0,
          }}
        >
          {title}
          <span
            style={{
              marginLeft: 10,
              fontFamily: "var(--font-mono)",
              fontSize: "var(--fs-sm)",
              fontWeight: 400,
              color: "var(--color-text-subtle)",
            }}
          >
            {total}
          </span>
        </h1>
        <CtaButton href={newHref} variant="primary">
          New product
        </CtaButton>
      </header>

      {/* Toolbar: search + status filter */}
      <div
        style={{
          display: "flex",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            debouncedSearch.cancel();
            startSearching(() =>
              navigate({ q: search.trim(), page: 1 }, { replace: true }),
            );
          }}
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            flex: "1 1 260px",
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              debouncedSearch(e.target.value);
            }}
            placeholder="Search name or SKU…"
            aria-label="Search products"
            style={{
              flex: 1,
              padding: "8px 34px 8px 12px",
              fontSize: "var(--fs-sm)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--r-md)",
              background: "var(--color-bg)",
              color: "var(--color-text)",
            }}
          />
          {isSearching && (
            <svg
              className="catalog-search-spinner"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden
              style={{ position: "absolute", right: 12 }}
            >
              <circle
                cx="12"
                cy="12"
                r="8.5"
                stroke="var(--color-border)"
                strokeWidth="2.4"
              />
              <path
                d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5"
                stroke="var(--brand-teal)"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </svg>
          )}
        </form>
        <select
          value={status}
          onChange={(e) => navigate({ status: e.target.value, page: 1 })}
          style={{
            padding: "8px 12px",
            fontSize: "var(--fs-sm)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--r-md)",
            background: "var(--color-surface)",
            color: "var(--color-text)",
          }}
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {msg && (
        <div
          role="status"
          style={{
            padding: "var(--s-3) var(--s-4)",
            borderRadius: "var(--r-md)",
            fontSize: "var(--fs-sm)",
            background:
              msg.kind === "ok"
                ? "color-mix(in srgb, var(--color-success, #16a34a) 12%, transparent)"
                : "color-mix(in srgb, var(--color-error) 12%, transparent)",
            color:
              msg.kind === "ok"
                ? "var(--color-success, #16a34a)"
                : "var(--color-error)",
            border: "1px solid currentColor",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--s-3)",
            flexWrap: "wrap",
            padding: "var(--s-3) var(--s-4)",
            borderRadius: "var(--r-md)",
            background: "var(--color-brand-soft)",
            border: "1px solid var(--color-border)",
          }}
        >
          <strong style={{ fontSize: "var(--fs-sm)" }}>
            {selectedCount} selected
          </strong>
          {ACTIONS.map((a) => (
            <button
              key={a.key}
              type="button"
              disabled={busy}
              onClick={() => runBulk(a.key)}
              style={{
                padding: "6px 12px",
                fontSize: "var(--fs-sm)",
                fontWeight: 600,
                borderRadius: "var(--r-md)",
                border: "1px solid var(--color-border)",
                background: a.danger
                  ? "color-mix(in srgb, var(--color-error) 10%, var(--color-surface))"
                  : "var(--color-surface)",
                color: a.danger ? "var(--color-error)" : "var(--color-text)",
                cursor: busy ? "default" : "pointer",
                opacity: busy ? 0.6 : 1,
              }}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            onClick={clearSelection}
            style={{
              marginLeft: "auto",
              padding: "6px 10px",
              fontSize: "var(--fs-sm)",
              border: "none",
              background: "transparent",
              color: "var(--color-text-muted)",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      )}

      {/* "Select all matching" banner */}
      {allOnPage && !allMatching && total > rows.length && (
        <div
          style={{
            fontSize: "var(--fs-sm)",
            color: "var(--color-text-muted)",
            textAlign: "center",
          }}
        >
          All {rows.length} on this page selected.{" "}
          <button
            type="button"
            onClick={() => setAllMatching(true)}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--color-brand-deep)",
              fontWeight: 600,
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Select all {total} matching this filter
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-8)",
            textAlign: "center",
            color: "var(--color-text-muted)",
          }}
        >
          No products match.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                minWidth: "680px",
              }}
            >
              <thead>
                <tr>
                  <th style={{ ...th, width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all on page"
                      checked={allOnPage}
                      onChange={(e) => toggleAllOnPage(e.target.checked)}
                    />
                  </th>
                  <th style={th}>Name</th>
                  <th style={th}>SKU</th>
                  <th style={{ ...th, textAlign: "right" }}>Price</th>
                  <th style={{ ...th, textAlign: "right" }}>Stock</th>
                  <th style={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const checked = allMatching || selected.has(p.id);
                  return (
                    <tr
                      key={p.id}
                      style={
                        checked
                          ? { background: "var(--color-brand-soft)" }
                          : undefined
                      }
                    >
                      <td style={{ ...td, width: 36 }}>
                        <input
                          type="checkbox"
                          aria-label={`Select ${p.name}`}
                          checked={checked}
                          disabled={allMatching}
                          onChange={(e) => toggleOne(p.id, e.target.checked)}
                        />
                      </td>
                      <td style={td}>
                        <Link
                          href={`${basePath}/${p.id}`}
                          style={{
                            color: "var(--color-brand-deep)",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          {p.name || "(untitled)"}
                        </Link>
                        {p.featured && (
                          <span
                            style={{
                              marginLeft: 8,
                              fontSize: 10,
                              color: "var(--color-secondary-deep)",
                              fontWeight: 700,
                            }}
                          >
                            ★ FEATURED
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          ...td,
                          fontFamily: "var(--font-mono)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        {p.sku}
                      </td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {p.priceLabel}
                      </td>
                      <td
                        style={{
                          ...td,
                          textAlign: "right",
                          fontWeight: p.lowStock ? 700 : 400,
                          color: p.lowStock
                            ? "var(--color-error)"
                            : "var(--color-text)",
                        }}
                      >
                        {p.stock}
                      </td>
                      <td style={{ ...td, textTransform: "capitalize" }}>
                        {p.status}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "var(--s-4)",
            fontSize: "var(--fs-sm)",
            color: "var(--color-text-muted)",
          }}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => navigate({ page: page - 1 })}
            style={pagerStyle(page <= 1)}
          >
            ← Prev
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => navigate({ page: page + 1 })}
            style={pagerStyle(page >= pages)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function pagerStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    border: "1px solid var(--color-border)",
    borderRadius: "var(--r-md)",
    background: "var(--color-surface)",
    color: disabled ? "var(--color-text-subtle)" : "var(--color-text)",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
