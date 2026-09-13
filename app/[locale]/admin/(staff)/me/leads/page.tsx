import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { myLeads } from "@/lib/services/me.service";
import { salesLeadStatusEnum } from "@/lib/schemas/sales-lead";
import { districtLabel } from "@/lib/bd/districts";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, cap, day } from "../_shared";

export const dynamic = "force-dynamic";

const LIST: ListConfig = { filters: ["status"] };

type Row = {
  id: string;
  organisation: string;
  code: string;
  contact: string;
  phone: string;
  area: string | null;
  status: string;
  lastActivity: string;
};

/** Leads assigned to me, or that I brought in. Nobody else's. */
export default async function MyLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/leads");
  const query = parseListQuery(await searchParams, LIST);
  const page = await myLeads(session, {
    search: query.q,
    status: query.filters.status,
    page: query.page,
    pageSize: query.pageSize,
  });

  const rows: Row[] = page.items.map((l) => ({
    id: String(l._id),
    organisation: l.organisation,
    code: l.code,
    contact: l.contactName,
    phone: l.phone,
    area: districtLabel(l.area),
    status: l.status,
    lastActivity: day(l.lastActivityAt ?? l.createdAt),
  }));

  const columns: Column<Row>[] = [
    {
      key: "organisation",
      header: "Organisation",
      cell: (r) => (
        <Link
          href={`/admin/me/leads/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.organisation}
        </Link>
      ),
    },
    {
      key: "code",
      header: "Code",
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
      key: "area",
      header: "Region",
      mobile: "meta",
      cell: (r) => (
        <span className={r.area ? "" : "text-muted-foreground"}>
          {r.area ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      mobile: "meta",
      cell: (r) => (
        <StatusBadge tone={statusTone(r.status)}>{cap(r.status)}</StatusBadge>
      ),
    },
    {
      key: "last",
      header: "Last activity",
      mobile: "meta",
      cell: (r) => (
        <span className="text-muted-foreground">{r.lastActivity}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My leads"
        description="Leads assigned to you, and the ones you brought in."
      />
      <ListToolbar
        search={{ placeholder: "Search organisation, code, contact…" }}
        filters={[
          {
            param: "status",
            label: "Status",
            options: salesLeadStatusEnum.options.map((s) => ({
              value: s,
              label: cap(s),
            })),
          },
        ]}
        total={page.total}
        countLabel={`${page.total} lead${page.total === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No leads are assigned to you yet."
        minWidth={720}
      />
      {page.pages > 1 && (
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
