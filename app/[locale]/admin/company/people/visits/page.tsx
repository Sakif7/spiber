import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { parseListQuery, type ListConfig } from "@/lib/admin/list-params";
import { listVisits, employeeNames } from "@/lib/repositories/expenses.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  sortable: ["date", "purpose", "organisation", "created"],
  defaultSort: "date",
  filters: ["from", "to"],
};

type Row = {
  id: string;
  ref: string;
  date: string;
  purpose: string;
  organisation: string;
  location: string;
  who: string;
};

/** Director visits: the trips costs are claimed against. */
export default async function VisitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const query = parseListQuery(await searchParams, LIST);

  const page = await listVisits({
    search: query.q,
    from: query.filters.from,
    to: query.filters.to,
    sort: query.sort,
    dir: query.dir,
    page: query.page,
    pageSize: query.pageSize,
  }).catch(() => null);

  const names = await employeeNames(
    (page?.items ?? []).flatMap((v) => v.attendees.map(String)),
  ).catch(() => new Map());

  const rows: Row[] = (page?.items ?? []).map((v) => ({
    id: String(v._id),
    ref: v.ref,
    date: new Date(v.visitedAt).toLocaleDateString("en-GB", {
      timeZone: "Asia/Dhaka",
    }),
    purpose: v.purpose,
    organisation: v.organisation ?? "—",
    location: v.location ?? "",
    who: v.attendees.map((a) => names.get(String(a))?.name ?? "—").join(", "),
  }));

  const columns: Column<Row>[] = [
    {
      key: "purpose",
      header: "Visit",
      sortKey: "purpose",
      cell: (r) => (
        <Link
          href={`/admin/company/people/visits/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.purpose}
        </Link>
      ),
    },
    {
      key: "organisation",
      header: "Organisation",
      sortKey: "organisation",
      mobile: "meta",
      cell: (r) => (
        <span>
          <span className="block">{r.organisation}</span>
          {r.location && (
            <span className="text-muted-foreground block text-xs">
              {r.location}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "who",
      header: "Who went",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.who}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortKey: "date",
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.date}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Visits"
        description="Marketing and lead-generation trips, and the costs claimed against them."
        action={
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/admin/company/people/visits/new">
              <Plus className="size-4" />
              Record visit
            </Link>
          </Button>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search purpose, organisation, reference…" }}
        sort={{
          options: [
            { value: "date", label: "Date of visit" },
            { value: "organisation", label: "Organisation", defaultDir: "asc" },
            { value: "created", label: "Recently added" },
          ],
        }}
        currentSort={{ key: query.sort, dir: query.dir }}
        dateRange
        total={page?.total ?? 0}
        countLabel={`${page?.total ?? 0} visit${(page?.total ?? 0) === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No visits recorded yet."
        minWidth={760}
      />
      {page && page.pages > 1 && (
        <Pagination
          page={page.page}
          pages={page.pages}
          total={page.total}
          pageSize={page.pageSize}
          noun="visits"
        />
      )}
    </div>
  );
}
