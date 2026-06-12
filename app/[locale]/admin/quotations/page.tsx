import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  listQuotations,
  type QuotationListParams,
} from "@/lib/repositories/quotations.repo";
import { formatBDT } from "@/lib/money";
import type { QuotationStatus } from "@/lib/schemas/quotation";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { StatusFilterPills } from "@/components/admin/ui/status-filter";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { DataTable, type Column } from "@/components/admin/ui/data-table";

export const dynamic = "force-dynamic";

const STATUSES = [
  "all",
  "new",
  "quoted",
  "negotiating",
  "won",
  "lost",
] as const;

type Row = Awaited<ReturnType<typeof listQuotations>>["items"][number];

export default async function AdminQuotationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  const { status } = await searchParams;
  setRequestLocale(locale);

  const filter: QuotationListParams = { pageSize: 100 };
  if (status && status !== "all") filter.status = status as QuotationStatus;

  let rows: Row[] = [];
  try {
    rows = (await listQuotations(filter)).items;
  } catch {
    rows = [];
  }

  const columns: Column<Row>[] = [
    {
      key: "ref",
      header: "Reference",
      cell: (q) => (
        <Link
          href={`/admin/quotations/${String(q._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {q.quotationNumber}
        </Link>
      ),
    },
    { key: "requester", header: "Requester", cell: (q) => q.contact.name },
    {
      key: "organization",
      header: "Organization",
      cell: (q) => (
        <span className="text-muted-foreground">
          {q.contact.organization ?? "—"}
        </span>
      ),
    },
    {
      key: "items",
      header: "Items",
      align: "right",
      cell: (q) => q.items.length,
    },
    {
      key: "status",
      header: "Status",
      cell: (q) => <StatusBadge>{q.status}</StatusBadge>,
    },
    {
      key: "quoted",
      header: "Quoted",
      align: "right",
      cell: (q) =>
        q.quote?.amountMinor != null
          ? formatBDT(q.quote.amountMinor, "en")
          : "—",
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      cell: (q) => (
        <span className="text-muted-foreground">
          {new Date(q.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Quotations"
        description="Instruments quotation (RFQ) pipeline — review, quote, and close."
        action={
          // eslint-disable-next-line @next/next/no-html-link-for-pages -- API CSV download, not a page route
          <a
            href="/api/admin/quotations/export"
            className="text-primary font-medium hover:underline"
          >
            Export CSV
          </a>
        }
      />
      <StatusFilterPills
        statuses={STATUSES}
        active={status ?? "all"}
        basePath="/admin/quotations"
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(q) => String(q._id)}
        empty="No quotation requests yet."
        minWidth={760}
      />
    </div>
  );
}
