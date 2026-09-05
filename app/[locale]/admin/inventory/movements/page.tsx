import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Download } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  listMovementsForAdmin,
  productUnitLabelsByIds,
  type ProductUnitLabels,
} from "@/lib/repositories/inventory.repo";
import {
  decorateMovements,
  MOVEMENT_TYPE_LABEL,
  type MovementRow,
} from "@/lib/services/inventory-ledger.service";
import { movementTypeEnum, type MovementType } from "@/lib/schemas/inventory";
import {
  listQueryString,
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, type Tone } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const TYPES = movementTypeEnum.options;
const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "set", label: "Set to" },
  { value: "bulk", label: "Bulk receive" },
  { value: "csv", label: "CSV import" },
  { value: "override", label: "Admin override" },
];
const TYPE_TONE: Record<MovementType, Tone> = {
  purchase: "success",
  sale: "info",
  adjustment: "neutral",
  return: "warning",
};
const STORE_LABEL: Record<string, string> = {
  instruments: "Medtrade",
  marketplace: "Spiber Kart",
};

const LIST: ListConfig = {
  sortable: ["date", "qty", "type"],
  defaultSort: "date",
  filters: ["type", "source", "product", "variant", "from", "to"],
  defaultPageSize: 50,
};

/** The stock ledger: every movement with its provenance, order and admin. */
export default async function StockMovementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const f = query.filters;
  const type = TYPES.includes(f.type as MovementType)
    ? (f.type as MovementType)
    : undefined;
  const source = SOURCES.some((s) => s.value === f.source)
    ? f.source
    : undefined;
  const productId = f.product || undefined;
  const variantId = productId && f.variant ? f.variant : undefined;
  const filtered = Boolean(
    query.q || type || source || productId || f.from || f.to,
  );

  let rows: MovementRow[] = [];
  let total = 0;
  let pages = 1;
  let productOption: { value: string; label: string } | null = null;
  try {
    const [res, labels] = await Promise.all([
      listMovementsForAdmin({
        search: query.q || undefined,
        type,
        source,
        productId,
        variantId,
        from: f.from,
        to: f.to,
        sort: query.sort,
        dir: query.dir,
        page: query.page,
        pageSize: query.pageSize,
      }),
      productId
        ? productUnitLabelsByIds([productId])
        : ({} as Record<string, ProductUnitLabels>),
    ]);
    total = res.total;
    pages = res.pages;
    rows = await decorateMovements(res.items);
    const label = productId ? labels[productId] : undefined;
    if (productId) {
      const variant = variantId ? label?.variants[variantId] : undefined;
      productOption = {
        value: productId,
        label: label
          ? `${label.name}${variant ? ` · ${variant.label}` : ""}`
          : "Selected product",
      };
    }
  } catch {
    rows = [];
  }

  const qs = listQueryString(query, LIST);
  const exportHref = `/api/admin/inventory/movements/export${qs ? `?${qs}` : ""}`;

  const columns: Column<MovementRow>[] = [
    {
      key: "date",
      header: "Date",
      sortKey: "date",
      mobile: "meta",
      cell: (m) => (
        <span className="text-muted-foreground whitespace-nowrap tabular-nums">
          {new Date(m.at).toLocaleString("en-GB", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      ),
    },
    {
      key: "product",
      header: "Product",
      mobile: "primary",
      cell: (m) => (
        <div className="min-w-0">
          <Link
            href={`/admin/inventory?q=${encodeURIComponent(m.sku)}`}
            className="text-foreground block truncate font-medium hover:underline"
          >
            {m.productName}
            {m.variantLabel && (
              <span className="text-muted-foreground font-normal">
                {" "}
                · {m.variantLabel}
              </span>
            )}
          </Link>
          <p className="text-muted-foreground font-mono text-xs">
            {m.sku}
            {m.storefront
              ? ` · ${STORE_LABEL[m.storefront] ?? m.storefront}`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      sortDir: "asc",
      mobile: "meta",
      cell: (m) => (
        <StatusBadge tone={TYPE_TONE[m.type]}>
          {MOVEMENT_TYPE_LABEL[m.type] ?? m.type}
        </StatusBadge>
      ),
    },
    {
      key: "qty",
      header: "Change",
      align: "right",
      sortKey: "qty",
      mobile: "meta",
      cell: (m) => (
        <span
          className={cn(
            "font-mono font-semibold tabular-nums",
            m.qtyDelta < 0 ? "text-destructive" : "text-[var(--color-success)]",
          )}
        >
          {m.qtyDelta > 0 ? `+${m.qtyDelta}` : m.qtyDelta}
        </span>
      ),
    },
    {
      key: "after",
      header: "Balance",
      align: "right",
      mobile: "meta",
      cell: (m) => (
        <span className="text-muted-foreground font-mono tabular-nums">
          {m.stockAfter == null ? "—" : m.stockAfter}
        </span>
      ),
    },
    {
      key: "source",
      header: "Source",
      mobile: "meta",
      cell: (m) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {m.source}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      mobile: "meta",
      cell: (m) =>
        m.reason ? (
          <span
            className="text-foreground block max-w-[18rem] truncate"
            title={m.reason}
          >
            {m.reason}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "order",
      header: "Order",
      mobile: "meta",
      cell: (m) =>
        m.orderId ? (
          <Link
            href={`/admin/orders/${m.orderId}`}
            className="text-primary font-mono text-xs font-medium hover:underline"
          >
            {m.orderNumber ?? "Order"}
          </Link>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "admin",
      header: "By",
      mobile: "meta",
      cell: (m) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {m.adminName ?? (m.orderId ? "Customer order" : "System")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Stock movements"
        description="Every stock change — sales, returns, deliveries, adjustments and overrides — with the balance after each one."
        action={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/inventory">
                <ArrowLeft className="size-4" />
                Inventory
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={exportHref} download>
                <Download className="size-4" />
                Export CSV
              </a>
            </Button>
          </>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search product name or SKU…" }}
        filters={[
          {
            param: "type",
            label: "Type",
            kind: "pills",
            options: TYPES.map((t) => ({
              value: t,
              label: MOVEMENT_TYPE_LABEL[t],
            })),
          },
          {
            param: "source",
            label: "Source",
            kind: "select",
            allLabel: "Any",
            options: SOURCES,
          },
          ...(productOption
            ? [
                {
                  param: "product",
                  label: "Product",
                  kind: "select" as const,
                  allLabel: "All products",
                  options: [productOption],
                },
              ]
            : []),
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "qty", label: "Change" },
            { value: "type", label: "Type", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} movement${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(m) => m.id}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered ? "No movements match these filters." : "No movements yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Every sale, delivery and adjustment is recorded here automatically."
        }
        minWidth={1040}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="movements"
      />
    </div>
  );
}
