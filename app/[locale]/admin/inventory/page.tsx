import { setRequestLocale } from "next-intl/server";
import {
  AlertTriangle,
  Banknote,
  Boxes,
  History,
  PackageX,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  latestMovementsByUnits,
  listStockUnits,
  stockKpis,
  type StockKpis,
  type StockUnit,
  type StockUnitSort,
} from "@/lib/repositories/inventory.repo";
import {
  categoryWithDescendantIds,
  listBrands,
  listCategories,
} from "@/lib/repositories/taxonomy.repo";
import { sellerNamesByIds } from "@/lib/repositories/sellers.repo";
import {
  digestRecipient,
  lastDigestSentAt,
} from "@/lib/services/inventory-alerts.service";
import { localize } from "@/lib/schemas/localized";
import { formatBDT } from "@/lib/money";
import type { ProductStatus, Storefront } from "@/lib/schemas/catalog";
import {
  listHref,
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatCard } from "@/components/admin/ui/stat-card";
import { InventoryTable } from "@/components/admin/inventory/inventory-table";
import { CsvReceiveButton } from "@/components/admin/inventory/csv-receive-dialog";
import { SendDigestButton } from "@/components/admin/inventory/send-digest-button";
import type { HubUnit } from "@/components/admin/inventory/types";

export const dynamic = "force-dynamic";

const BASE = "/admin/inventory";

/** Public store names for the filter + column (same as the Orders page). */
const STORE_PARAM: Record<string, Storefront> = {
  medtrade: "instruments",
  kart: "marketplace",
};
const STORE_LABEL: Record<Storefront, string> = {
  instruments: "Medtrade",
  marketplace: "Spiber Kart",
};
const STATUSES: ProductStatus[] = ["active", "draft", "archived"];
const SORTS: StockUnitSort[] = ["updated", "stock", "name", "sku", "value"];

const LIST: ListConfig = {
  sortable: SORTS,
  defaultSort: "updated",
  filters: [
    "store",
    "level",
    "owner",
    "tracking",
    "status",
    "category",
    "brand",
  ],
  defaultPageSize: 50,
};

const EMPTY_KPIS: StockKpis = {
  trackedUnits: 0,
  untrackedUnits: 0,
  low: 0,
  out: 0,
  stockValueMinor: 0,
};

type Option = { value: string; label: string };

export default async function InventoryPage({
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
  const storefront = STORE_PARAM[f.store];
  const level =
    f.level === "low" || f.level === "out" || f.level === "ok"
      ? f.level
      : undefined;
  const owner =
    f.owner === "house" || f.owner === "seller" ? f.owner : undefined;
  const tracked =
    f.tracking === "tracked"
      ? true
      : f.tracking === "untracked"
        ? false
        : undefined;
  const status = STATUSES.includes(f.status as ProductStatus)
    ? (f.status as ProductStatus)
    : undefined;
  const filtered = Boolean(
    query.q ||
    storefront ||
    level ||
    owner ||
    tracked !== undefined ||
    status ||
    f.category ||
    f.brand,
  );

  let units: HubUnit[] = [];
  let total = 0;
  let pages = 1;
  let kpis: StockKpis = EMPTY_KPIS;
  let categoryOptions: Option[] = [];
  let brandOptions: Option[] = [];
  let lastSent: string | null = null;
  const recipient = digestRecipient();

  try {
    const [cats, brs] = await Promise.all([listCategories(), listBrands()]);
    const catName = new Map(
      cats.map((c) => [String(c._id), localize(c.name, "en")]),
    );
    const brandName = new Map(
      brs.map((b) => [String(b._id), localize(b.name, "en")]),
    );
    categoryOptions = cats.map((c) => ({
      value: String(c._id),
      label: `${localize(c.name, "en")} · ${STORE_LABEL[c.storefront] ?? c.storefront}`,
    }));
    brandOptions = brs.map((b) => ({
      value: String(b._id),
      label: localize(b.name, "en"),
    }));

    const categoryIds = f.category
      ? await categoryWithDescendantIds(f.category)
      : undefined;

    const [res, k, last] = await Promise.all([
      listStockUnits({
        storefront,
        search: query.q || undefined,
        categoryIds,
        brandId: f.brand || undefined,
        owner,
        tracked,
        level,
        status,
        sort: query.sort as StockUnitSort,
        dir: query.dir,
        page: query.page,
        pageSize: query.pageSize,
      }),
      stockKpis(storefront),
      lastDigestSentAt(),
    ]);
    total = res.total;
    pages = res.pages;
    kpis = k;
    lastSent = last;

    const sellerIds = [
      ...new Set(
        res.items
          .map((u) => u.sellerId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const [latest, sellerNames] = await Promise.all([
      latestMovementsByUnits(res.items),
      sellerIds.length > 0
        ? sellerNamesByIds(sellerIds)
        : ({} as Record<string, string>),
    ]);

    const toHub = (u: StockUnit): HubUnit => ({
      key: u.key,
      productId: u.productId,
      variantId: u.variantId,
      name: u.name,
      variantLabel: u.variantLabel,
      sku: u.sku,
      storefront: u.storefront,
      storeLabel: STORE_LABEL[u.storefront],
      status: u.status,
      tracked: u.tracked,
      trackStock: u.trackStock,
      stock: u.stock,
      threshold: u.threshold,
      level: u.level,
      priceMinor: u.priceMinor,
      valueLabel:
        u.tracked && u.priceMinor != null
          ? formatBDT(u.stock * u.priceMinor)
          : null,
      seller: u.sellerId
        ? { id: u.sellerId, name: sellerNames[u.sellerId] ?? "Seller" }
        : null,
      categoryName: u.categoryId ? (catName.get(u.categoryId) ?? null) : null,
      brandName: u.brandId ? (brandName.get(u.brandId) ?? null) : null,
      editorHref:
        u.storefront === "instruments"
          ? `/admin/products/${u.productId}`
          : `/admin/marketplace/products/${u.productId}`,
      historyHref: `/admin/inventory/movements?product=${u.productId}${
        u.variantId ? `&variant=${encodeURIComponent(u.variantId)}` : ""
      }`,
      lastMovement: latest[u.key] ?? null,
    });
    units = res.items.map(toHub);
  } catch {
    units = [];
  }

  const attention = kpis.low + kpis.out;
  const kpiHref = (patch: Record<string, string | undefined>) =>
    listHref(BASE, query, LIST, {
      page: 1,
      sort: "stock",
      dir: "asc",
      filters: { level: undefined, tracking: undefined, ...patch },
    });

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Inventory"
        description={
          attention > 0
            ? `${attention} tracked unit${attention === 1 ? "" : "s"} at or below the low-stock threshold. Seller listings are read-only unless you override.`
            : "Every tracked unit is above its low-stock threshold. Seller listings are read-only unless you override."
        }
        action={
          <>
            <Button asChild variant="ghost" size="sm">
              <Link href="/admin/inventory/movements">
                <History className="size-4" />
                Movements
              </Link>
            </Button>
            <SendDigestButton recipient={recipient} lastSentAt={lastSent} />
            <CsvReceiveButton />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tracked units"
          value={kpis.trackedUnits}
          icon={Boxes}
          tone="brand"
          hint={`${kpis.untrackedUnits} quotation-only, not tracked`}
          href={kpiHref({ tracking: "tracked" })}
        />
        <StatCard
          label="Low stock"
          value={kpis.low}
          icon={AlertTriangle}
          tone={kpis.low > 0 ? "warning" : "success"}
          hint="Above zero, at or below the threshold"
          href={kpiHref({ level: "low" })}
        />
        <StatCard
          label="Out of stock"
          value={kpis.out}
          icon={PackageX}
          tone={kpis.out > 0 ? "danger" : "success"}
          hint="Tracked units at zero"
          href={kpiHref({ level: "out" })}
        />
        <StatCard
          label="Stock value"
          value={formatBDT(kpis.stockValueMinor)}
          icon={Banknote}
          tone="info"
          hint="At list price · active, tracked units"
        />
      </div>

      <ListToolbar
        search={{ placeholder: "Search name or SKU…" }}
        filters={[
          {
            param: "store",
            label: "Store",
            kind: "pills",
            options: [
              { value: "medtrade", label: "Medtrade" },
              { value: "kart", label: "Spiber Kart" },
            ],
          },
          {
            param: "level",
            label: "Level",
            kind: "pills",
            options: [
              { value: "low", label: "Low" },
              { value: "out", label: "Out" },
              { value: "ok", label: "OK" },
            ],
          },
          {
            param: "owner",
            label: "Owner",
            kind: "pills",
            options: [
              { value: "house", label: "House" },
              { value: "seller", label: "Seller" },
            ],
          },
          {
            param: "tracking",
            label: "Tracking",
            kind: "pills",
            options: [
              { value: "tracked", label: "Tracked" },
              { value: "untracked", label: "Untracked" },
            ],
          },
          {
            param: "status",
            label: "Status",
            kind: "select",
            allLabel: "Active + draft",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "category",
            label: "Category",
            kind: "select",
            allLabel: "All",
            options: categoryOptions,
          },
          {
            param: "brand",
            label: "Brand",
            kind: "select",
            allLabel: "All",
            options: brandOptions,
          },
        ]}
        sort={{
          options: [
            { value: "updated", label: "Recently updated" },
            { value: "stock", label: "Stock", defaultDir: "asc" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "sku", label: "SKU", defaultDir: "asc" },
            { value: "value", label: "Stock value" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} stock unit${total === 1 ? "" : "s"}`}
      />

      <InventoryTable
        units={units}
        sort={{ key: query.sort, dir: query.dir }}
        filtered={filtered}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="units"
      />
    </div>
  );
}
