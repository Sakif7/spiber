import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { listSalesLeads, paidLeadIds } from "@/lib/repositories/sales.repo";
import { activeEmployeeOptions } from "@/lib/repositories/expenses.repo";
import {
  salesLeadStatusEnum,
  leadReasonEnum,
  LEAD_REASON_LABEL,
  type LeadReason,
} from "@/lib/schemas/sales-lead";
import { DISTRICT_OPTIONS, districtLabel } from "@/lib/bd/districts";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { LeadForm } from "@/components/admin/sales/lead-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "organisation", "status", "activity", "code", "area"],
  defaultSort: "activity",
  filters: ["status", "from", "to", "area", "type", "reason"],
};

type Row = {
  id: string;
  organisation: string;
  code: string;
  contact: string;
  phone: string;
  email: string | null;
  area: string | null;
  source: string | null;
  reasons: LeadReason[];
  /** Derived, never stored: this organisation has paid at least one invoice. */
  isClient: boolean;
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
  // Here too, not only in the layout: Next ships a page's payload even when
  // its layout shows the refusal instead.
  if (!(await requireSuperAdmin())) return null;
  const query = parseListQuery(await searchParams, LIST);

  const [page, paid, employees] = await Promise.all([
    listSalesLeads({
      search: query.q,
      status: query.filters.status,
      area: query.filters.area,
      type: query.filters.type,
      reason: query.filters.reason,
      from: query.filters.from,
      to: query.filters.to,
      sort: query.sort,
      dir: query.dir,
      page: query.page,
      pageSize: query.pageSize,
    }).catch(() => null),
    paidLeadIds().catch(() => [] as string[]),
    activeEmployeeOptions().catch(() => []),
  ]);
  const paidSet = new Set(paid);

  const rows: Row[] = (page?.items ?? []).map((l) => ({
    id: String(l._id),
    organisation: l.organisation,
    code: l.code,
    contact: l.contactName,
    phone: l.phone,
    email: l.email ?? null,
    area: districtLabel(l.area),
    source: l.sourceName ?? null,
    // `.lean()` applies no defaults, so a lead saved before this field
    // existed reads back undefined rather than an empty array.
    reasons: l.reasons ?? [],
    isClient: paidSet.has(String(l._id)),
    status: l.status,
    createdAt: new Date(l.createdAt).toLocaleDateString(),
  }));

  const columns: Column<Row>[] = [
    {
      key: "organisation",
      header: "Organisation",
      sortKey: "organisation",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/admin/company/sales/leads/${r.id}`}
            className="text-primary font-medium hover:underline"
          >
            {r.organisation}
          </Link>
          {r.isClient && <StatusBadge tone="success">Client</StatusBadge>}
        </span>
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
      key: "area",
      header: "Region",
      sortKey: "area",
      mobile: "meta",
      cell: (r) => (
        <span className={r.area ? "" : "text-muted-foreground"}>
          {r.area ?? "—"}
        </span>
      ),
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
      key: "source",
      header: "Source",
      mobile: "meta",
      cell: (r) => (
        <span className={r.source ? "" : "text-muted-foreground"}>
          {r.source ?? "—"}
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      mobile: "meta",
      cell: (r) =>
        r.reasons.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {r.reasons.map((x) => (
              <StatusBadge key={x} tone="neutral">
                {LEAD_REASON_LABEL[x]}
              </StatusBadge>
            ))}
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
            <LeadForm employees={employees} />
          </FormPanelButton>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search organisation, code, contact, source…" }}
        filters={[
          {
            param: "type",
            label: "Type",
            options: [
              { value: "client", label: "Clients (have paid)" },
              { value: "lead", label: "Leads (not yet)" },
            ],
          },
          {
            param: "status",
            label: "Status",
            options: salesLeadStatusEnum.options.map((s) => ({
              value: s,
              label: label(s),
            })),
          },
          {
            param: "area",
            label: "Region",
            options: DISTRICT_OPTIONS,
          },
          {
            param: "reason",
            label: "Reason",
            options: leadReasonEnum.options.map((r) => ({
              value: r,
              label: LEAD_REASON_LABEL[r],
            })),
          },
        ]}
        sort={{
          options: [
            { value: "activity", label: "Last activity" },
            { value: "organisation", label: "Organisation", defaultDir: "asc" },
            { value: "area", label: "Region", defaultDir: "asc" },
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
        minWidth={1060}
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
