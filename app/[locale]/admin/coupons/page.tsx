import { setRequestLocale } from "next-intl/server";
import { listCouponsForAdmin } from "@/lib/repositories/coupons.repo";
import { formatBDT } from "@/lib/money";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { CouponForm } from "@/components/admin/coupon-form";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { SectionCard } from "@/components/admin/ui/section-card";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "code", "used", "expires"],
  defaultSort: "date",
  filters: ["state"],
};

type CouponRow = {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotalMinor: number | null;
  usageLimit: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
};

function valueLabel(c: CouponRow): string {
  return c.type === "percent" ? `${c.value}%` : formatBDT(c.value);
}

export default async function CouponsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const state =
    query.filters.state === "active" || query.filters.state === "inactive"
      ? query.filters.state
      : undefined;
  const filtered = Boolean(query.q || state);

  let coupons: CouponRow[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listCouponsForAdmin({
      state,
      search: query.q || undefined,
      sort: query.sort,
      dir: query.dir,
      page: query.page,
      pageSize: query.pageSize,
    });
    total = res.total;
    pages = res.pages;
    coupons = res.items.map((c) => ({
      id: String(c._id),
      code: c.code,
      type: c.type,
      value: c.value,
      minSubtotalMinor:
        typeof c.minSubtotalMinor === "number" ? c.minSubtotalMinor : null,
      usageLimit: typeof c.usageLimit === "number" ? c.usageLimit : null,
      usedCount: c.usedCount ?? 0,
      expiresAt: c.expiresAt ? new Date(c.expiresAt).toISOString() : null,
      active: Boolean(c.active),
    }));
  } catch {
    coupons = [];
  }

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      sortDir: "asc",
      cell: (c) => (
        <span className="text-primary font-mono text-xs font-medium">
          {c.code}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (c) => <span className="capitalize">{c.type}</span>,
    },
    { key: "value", header: "Value", cell: (c) => valueLabel(c) },
    {
      key: "minSubtotal",
      header: "Min subtotal",
      cell: (c) =>
        c.minSubtotalMinor === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          formatBDT(c.minSubtotalMinor)
        ),
    },
    {
      key: "usage",
      header: "Used / Limit",
      sortKey: "used",
      cell: (c) =>
        `${c.usedCount} / ${c.usageLimit === null ? "∞" : c.usageLimit}`,
    },
    {
      key: "expires",
      header: "Expires",
      sortKey: "expires",
      sortDir: "asc",
      cell: (c) =>
        c.expiresAt ? (
          new Date(c.expiresAt).toLocaleDateString("en-GB")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: "active",
      header: "Status",
      cell: (c) => (
        <StatusBadge>{c.active ? "Active" : "Inactive"}</StatusBadge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Coupons"
        description="Discount codes applied at checkout on Medtrade and Spiber Kart."
      />

      <ListToolbar
        search={{ placeholder: "Search code…" }}
        filters={[
          {
            param: "state",
            label: "Status",
            kind: "pills",
            options: [
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ],
          },
        ]}
        sort={{
          options: [
            { value: "date", label: "Created" },
            { value: "code", label: "Code", defaultDir: "asc" },
            { value: "used", label: "Times used" },
            { value: "expires", label: "Expiry", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} coupon${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={coupons}
        getRowKey={(c) => c.id}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No coupons match these filters." : "No coupons yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create the first discount code with the form below."
        }
        minWidth={760}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="coupons"
      />

      <SectionCard
        title="New coupon"
        description="Percent or fixed-amount discounts, optionally scoped to one store."
      >
        <CouponForm />
      </SectionCard>
    </div>
  );
}
