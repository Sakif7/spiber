import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { listBannersForAdmin } from "@/lib/repositories/banners.repo";
import { localize } from "@/lib/schemas/localized";
import { bannerSlotEnum, type BannerSlot } from "@/lib/schemas/banner";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { Pagination } from "@/components/admin/ui/pagination";
import { RowActions } from "@/components/admin/ui/row-actions";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const SLOTS = bannerSlotEnum.options;
const SLOT_LABEL: Record<BannerSlot, string> = {
  hero: "Hero (carousel)",
  deal: "Deal band",
  strip: "Strip",
};

const LIST: ListConfig = {
  sortable: ["position", "date", "title", "slot", "active"],
  defaultSort: "position",
  defaultDir: "asc",
  filters: ["slot", "active", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listBannersForAdmin>>["items"][number];

function schedule(b: Row): string {
  const fmt = (d: Date | null | undefined) =>
    d ? new Date(d).toLocaleDateString("en-GB") : null;
  const from = fmt(b.startsAt);
  const to = fmt(b.endsAt);
  if (!from && !to) return "Always";
  return `${from ?? "…"} → ${to ?? "…"}`;
}

export default async function AdminBannersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const slot = SLOTS.includes(query.filters.slot as BannerSlot)
    ? (query.filters.slot as BannerSlot)
    : undefined;
  const active =
    query.filters.active === "1"
      ? true
      : query.filters.active === "0"
        ? false
        : undefined;
  const filtered = Boolean(
    query.q || slot || active !== undefined || query.filters.from,
  );

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listBannersForAdmin({
      slot,
      active,
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
      key: "title",
      header: "Title",
      sortKey: "title",
      sortDir: "asc",
      cell: (b) => (
        <Link
          href={`/admin/marketplace/banners/${String(b._id)}`}
          className="text-primary font-medium hover:underline"
        >
          {localize(b.title, "en") || "(untitled)"}
        </Link>
      ),
    },
    {
      key: "slot",
      header: "Slot",
      sortKey: "slot",
      sortDir: "asc",
      cell: (b) => (
        <span className="text-muted-foreground">
          {SLOT_LABEL[b.slot as BannerSlot] ?? b.slot}
        </span>
      ),
    },
    {
      key: "position",
      header: "Position",
      align: "right",
      sortKey: "position",
      sortDir: "asc",
      cell: (b) => <span className="tabular-nums">{b.position}</span>,
    },
    {
      key: "schedule",
      header: "Schedule",
      cell: (b) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {schedule(b)}
        </span>
      ),
    },
    {
      key: "active",
      header: "Status",
      sortKey: "active",
      cell: (b) => (
        <StatusBadge>{b.active ? "Active" : "Inactive"}</StatusBadge>
      ),
    },
    {
      key: "date",
      header: "Created",
      align: "right",
      sortKey: "date",
      cell: (b) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(b.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (b) => (
        <RowActions
          label={`Actions for ${localize(b.title, "en")}`}
          actions={[
            {
              label: "Edit banner",
              href: `/admin/marketplace/banners/${String(b._id)}`,
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
        title="Banners"
        description="Spiber Kart promotional banners, their slots and schedules."
        action={
          <Button asChild size="sm">
            <Link href="/admin/marketplace/banners/new">
              <Plus className="size-4" />
              New banner
            </Link>
          </Button>
        }
      />

      <ListToolbar
        search={{ placeholder: "Search banner title…" }}
        filters={[
          {
            param: "slot",
            label: "Slot",
            kind: "pills",
            options: SLOTS.map((s) => ({ value: s, label: SLOT_LABEL[s] })),
          },
          {
            param: "active",
            label: "Status",
            kind: "pills",
            options: [
              { value: "1", label: "Active" },
              { value: "0", label: "Inactive" },
            ],
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "position", label: "Position", defaultDir: "asc" },
            { value: "date", label: "Created" },
            { value: "title", label: "Title", defaultDir: "asc" },
            { value: "slot", label: "Slot", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} banner${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(b) => String(b._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={filtered ? "No banners match these filters." : "No banners yet."}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Create a Hero banner to power the Spiber Kart carousel, or a Deal banner for the promo band."
        }
        emptyAction={
          filtered ? undefined : (
            <Button asChild size="sm">
              <Link href="/admin/marketplace/banners/new">New banner</Link>
            </Button>
          )
        }
        minWidth={800}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="banners"
      />
    </div>
  );
}
