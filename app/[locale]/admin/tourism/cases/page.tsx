import { setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { listMedicalCases } from "@/lib/repositories/medicalCases.repo";
import { formatBDT } from "@/lib/money";
import {
  medicalCaseStatusEnum,
  type MedicalCaseStatus,
} from "@/lib/schemas/medical-case";
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

const STATUSES = medicalCaseStatusEnum.options;

const LIST: ListConfig = {
  sortable: ["date", "number", "patient", "status", "quoted"],
  defaultSort: "date",
  filters: ["status", "from", "to"],
};

type Row = Awaited<ReturnType<typeof listMedicalCases>>["items"][number];

export default async function AdminCasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = STATUSES.includes(query.filters.status as MedicalCaseStatus)
    ? (query.filters.status as MedicalCaseStatus)
    : undefined;
  const filtered = Boolean(query.q || status || query.filters.from);

  let rows: Row[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listMedicalCases({
      status,
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
      key: "ref",
      header: "Reference",
      sortKey: "number",
      sortDir: "asc",
      cell: (c) => (
        <Link
          href={`/admin/tourism/cases/${String(c._id)}`}
          className="text-primary font-mono text-xs font-medium hover:underline"
        >
          {c.caseNumber}
        </Link>
      ),
    },
    {
      key: "patient",
      header: "Patient",
      sortKey: "patient",
      sortDir: "asc",
      cell: (c) => c.patient.name,
    },
    {
      key: "country",
      header: "Country",
      cell: (c) => (
        <span className="text-muted-foreground">{c.patient.country}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      sortDir: "asc",
      cell: (c) => <StatusBadge>{c.status}</StatusBadge>,
    },
    {
      key: "docs",
      header: "Docs",
      align: "right",
      cell: (c) => c.documents?.length ?? 0,
    },
    {
      key: "quoted",
      header: "Quoted",
      align: "right",
      sortKey: "quoted",
      cell: (c) =>
        c.quotation?.amountMinor != null
          ? formatBDT(c.quotation.amountMinor, "en")
          : "—",
    },
    {
      key: "date",
      header: "Date",
      align: "right",
      sortKey: "date",
      cell: (c) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(c.createdAt).toLocaleDateString("en-GB")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      mobile: "actions",
      className: "w-10",
      cell: (c) => (
        <RowActions
          label={`Actions for ${c.caseNumber}`}
          actions={[
            {
              label: "Open case",
              href: `/admin/tourism/cases/${String(c._id)}`,
              icon: "view",
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Medical cases"
        description="Patient case pipeline — review, quote, and arrange treatment."
      />

      <ListToolbar
        search={{ placeholder: "Search case #, patient, email, country…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: STATUSES.map((s) => ({
              value: s,
              label: s.replace(/_/g, " "),
            })),
          },
        ]}
        dateRange
        sort={{
          options: [
            { value: "date", label: "Date" },
            { value: "patient", label: "Patient", defaultDir: "asc" },
            { value: "status", label: "Status", defaultDir: "asc" },
            { value: "quoted", label: "Quoted amount" },
            { value: "number", label: "Reference", defaultDir: "asc" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        total={total}
        countLabel={`${total} case${total === 1 ? "" : "s"}`}
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(c) => String(c._id)}
        sort={{ key: query.sort, dir: query.dir }}
        empty={
          filtered
            ? "No medical cases match these filters."
            : "No medical cases yet."
        }
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "A case opens when a patient submits the secure consultation form on the Tourism site."
        }
        minWidth={860}
      />

      <Pagination
        page={query.page}
        pages={pages}
        total={total}
        pageSize={query.pageSize}
        noun="cases"
      />
    </div>
  );
}
