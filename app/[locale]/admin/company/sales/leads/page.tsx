import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { listSalesLeads } from "@/lib/repositories/sales.repo";
import { salesLeadStatusEnum } from "@/lib/schemas/sales-lead";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { LeadForm } from "@/components/admin/sales/lead-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "organisation", "status", "activity", "code"],
  defaultSort: "activity",
  filters: ["status", "from", "to"],
};

type Row = {
  id: string;
  organisation: string;
  code: string;
  contact: string;
  phone: string;
  email: string | null;
  status: string;
  createdAt: string;
};

const label = (s: string) =>
  s.replace(/_/g, "").replace(/^./, (c) => c.toUpperCase());

/** Leads: the organisations the sales team sells to offline. */
export default async function SalesLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseListQuery(await searchParams, LIST);

  const page = await listSalesLeads({
    search: query.q,
    status: query.filters.status,
    from: query.filters.from,
    to: query.filters.to,
    sort: query.sort,
    dir: query.dir,
    page: query.page,
    pageSize: query.pageSize,
  }).catch(() => null);

  const rows: Row[] = (page?.items ?? []).map((l) => ({
    id: String(l._id),
    organisation: l.organisation,
    code: l.code,
    contact: l.contactName,
    phone: l.phone,
    email: l.email ?? null,
    status: l.status,
    createdAt: new Date(l.createdAt).toLocaleDateString(),
  }));

  const columns: Column<Row>[] = [
    {
      key: "organisation",
      header: "Organisation",
      sortKey: "organisation",
      cell: (r) => (
        <Link
          href={`/admin/company/sales/leads/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.organisation}
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      mobile: "meta",
      cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
    },
    {
      key: "contact",
      header: "Contact",
      mobile: "meta",
      cell: (r) => (
        <span>
          <span className="block">{r.contact}</span>
          <span className="text-muted-foreground block text-xs">{r.phone}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortKey: "status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={statusTone(r.status)}>{label(r.status)}</StatusBadge>
      ),
    },
    {
      key: "date",
      header: "Added",
      sortKey: "date",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.createdAt}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Sales leads"
        description="Hospitals, clinics and labs the sales team sells to."
        action={
          <FormPanelButton
            label="New lead"
            title="New lead"
            description="Hospitals, clinics and labs the sales team sells to."
          >
            <LeadForm />
          </FormPanelButton>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search organisation, code, contact…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            options: salesLeadStatusEnum.options.map((s) => ({
              value: s,
              label: label(s),
            })),
          },
        ]}
        sort={{
          options: [
            { value: "activity", label: "Last activity" },
            { value: "organisation", label: "Organisation", defaultDir: "asc" },
            { value: "date", label: "Date added" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        dateRange
        total={page?.total ?? 0}
        countLabel={`${page?.total ?? 0} lead${(page?.total ?? 0) === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No leads yet — add the first organisation."
        minWidth={760}
      />
      {page && page.pages > 1 && (
        <Pagination
          page={page.page}
          pages={page.pages}
          total={page.total}
          pageSize={page.pageSize}
          noun="leads"
        />
      )}
    </div>
  );
}
