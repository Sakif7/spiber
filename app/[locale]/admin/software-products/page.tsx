import { setRequestLocale } from "next-intl/server";
import { listSoftwareProducts } from "@/lib/repositories/software.repo";
import { formatBDT } from "@/lib/money";
import { localize } from "@/lib/schemas/localized";
import {
  deliveryTypeEnum,
  softwarePricingModelEnum,
  softwareStatusEnum,
  type SoftwareStatus,
} from "@/lib/schemas/systems";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { SoftwareDeleteButton } from "@/components/admin/software-product-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import {
  SoftwareProductForm,
  type SoftwareFormInitial,
} from "@/components/admin/software-product-form";
import { FormPanelTrigger } from "@/components/admin/ui/form-panel";

export const dynamic = "force-dynamic";

/** The list already holds the whole product, so the edit panel prefills
    straight from the row. */
const editInitial = (p: Row): SoftwareFormInitial => ({
  id: String(p._id),
  name: { en: p.name.en, bn: p.name.bn ?? "", ja: p.name.ja ?? "" },
  slug: p.slug,
  description: p.description
    ? {
        en: p.description.en ?? "",
        bn: p.description.bn ?? "",
        ja: p.description.ja ?? "",
      }
    : { en: "", bn: "", ja: "" },
  screenshots: p.screenshots,
  features: p.features.map((f) => ({
    en: f.en,
    bn: f.bn ?? "",
    ja: f.ja ?? "",
  })),
  pricingModel: p.pricingModel,
  priceMinor: p.priceMinor,
  demoUrl: p.demoUrl,
  deliveryType: p.deliveryType,
  assetKey: p.assetKey,
  externalApp: p.externalApp,
  affiliateRateBp: p.affiliate?.rateBp,
  status: p.status,
});

const STATUSES = softwareStatusEnum.options;
const PRICING = softwarePricingModelEnum.options;
const DELIVERY = deliveryTypeEnum.options;
const PRICING_LABEL: Record<string, string> = {
  one_time: "One-time",
  subscription: "Subscription",
  quote: "Quote",
};
const DELIVERY_LABEL: Record<string, string> = {
  asset: "Download",
  license: "License key",
  external: "External app",
};

const LIST: ListConfig = {
  sortable: ["date", "name", "price", "status"],
  defaultSort: "date",
  filters: ["status", "pricing", "delivery", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listSoftwareProducts>>["items"][number];

export default async function AdminSoftwareProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as SoftwareStatus)
    ? (query.filters.status as SoftwareStatus)
    : undefined;
  const pricingModel = (PRICING as readonly string[]).includes(
    query.filters.pricing,
  )
    ? query.filters.pricing
    : undefined;
  const deliveryType = (DELIVERY as readonly string[]).includes(
    query.filters.delivery,
  )
    ? query.filters.delivery
    : undefined;
  const filtered = Boolean(
    query.q || status || pricingModel || deliveryType || query.filters.from,
  );

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listSoftwareProducts({
      status,
      pricingModel,
      deliveryType,
      search: query.q || undefined,
      sort: query.sort,
      dir: query.dir,
      from: query.filters.from,
      to: query.filters.to,
      page: query.page,
      pageSize: query.pageSize,
    });
    rows = res.items;
    total = res.total;
    pages = res.pages;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      sortDir: "asc",
      cell: (p) => (
        <FormPanelTrigger
          label={localize(p.name, "en")}
          title="Edit software product"
          description={p.slug}
        >
          <SoftwareProductForm initial={editInitial(p)} />
        </FormPanelTrigger>
      ),
    },
    {
      key: "pricing",
      header: "Pricing",
      cell: (p) => (
        <span className="text-muted-foreground">
          {PRICING_LABEL[p.pricingModel] ?? p.pricingModel}
        </span>
      ),
    },
    {
      key: "delivery",
      header: "Delivery",
      cell: (p) => (
        <span className="text-muted-foreground">
          {DELIVERY_LABEL[p.deliveryType] ?? p.deliveryType}
        </span>
      ),
    },
    {
      key: "price",
      header: "Price",
      align: "right",
      sortKey: "price",
      className: "whitespace-nowrap",
      cell: (p) =>
        p.pricingModel === "quote"
          ? "—"
          : p.priceMinor
            ? formatBDT(p.priceMinor, "en")
            : "Free",
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (p) => <StatusBadge>{p.status}</StatusBadge>,
    },
    {
      key: "date",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (p) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(p.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-24",
      cell: (p) => (
        <span className="flex items-center justify-end gap-1">
          <SoftwareDeleteButton
            id={String(p._id)}
            name={localize(p.name, "en")}
          />
          <RowActions
            label={`Actions for ${localize(p.name, "en")}`}
            actions={[
              {
                label: "Edit product",
                icon: "edit",
                panel: {
                  title: "Edit software product",
                  description: p.slug,
                  content: <SoftwareProductForm initial={editInitial(p)} />,
                },
              },
            ]}
          />
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Software products"
        description="Digihealth software catalog — pricing model, delivery, and publish status."
        action={
          <FormPanelButton
            label="New product"
            title="New software product"
            description="A Digihealth product — pricing model, delivery and publish status."
          >
            <SoftwareProductForm />
          </FormPanelButton>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search product name…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({ value: s, label: s })),
          },
          {
            param: "pricing",
            label: "Pricing",
            kind: "pills",
            options: PRICING.map((p) => ({
              value: p,
              label: PRICING_LABEL[p],
            })),
          },
          {
            param: "delivery",
            label: "Delivery",
            kind: "pills",
            options: DELIVERY.map((d) => ({
              value: d,
              label: DELIVERY_LABEL[d],
            })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Created" },
            { value: "name", label: "Name", defaultDir: "asc" },
            { value: "price", label: "Price" },
            { value: "status", label: "Status", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} product${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(p) => String(p._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No software products match these filters."
            : "No software products yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create the first product with the New product button; it stays a draft until you activate it."
        }
        emptyAction={
          filtered ? undefined : (
            <FormPanelButton
              label="New product"
              title="New software product"
              description="A Digihealth product — pricing model, delivery and publish status."
              icon={false}
            >
              <SoftwareProductForm />
            </FormPanelButton>
          )
        }
        minWidth={820}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="products"
      />
    </div>
  );
}
