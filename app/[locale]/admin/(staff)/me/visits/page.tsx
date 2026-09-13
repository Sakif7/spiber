import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { parseListQuery } from "@/lib/admin/list-params";
import { myLeads, myVisits } from "@/lib/services/me.service";
import { activeEmployeeOptions } from "@/lib/repositories/expenses.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { Pagination } from "@/components/admin/ui/pagination";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { VisitForm } from "@/components/admin/hr/visit-form";
import { employeeOrRedirect, day } from "../_shared";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  ref: string;
  date: string;
  purpose: string;
  organisation: string;
  location: string;
  who: string;
};

/** Trips I was on. Recording one puts me on it automatically. */
export default async function MyVisitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/visits");
  const query = parseListQuery(await searchParams);
  const [page, people, leads] = await Promise.all([
    myVisits(session, {
      search: query.q,
      page: query.page,
      pageSize: query.pageSize,
    }),
    activeEmployeeOptions().catch(() => []),
    myLeads(session, { pageSize: 100 }).catch(() => null),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const me = String(session.employee._id);

  const rows: Row[] = page.items.map((v) => ({
    id: String(v._id),
    ref: v.ref,
    date: day(v.visitedAt),
    purpose: v.purpose,
    organisation: v.organisation ?? "—",
    location: v.location ?? "",
    who: v.attendees
      .map((a) => (String(a) === me ? "You" : (names.get(String(a)) ?? "—")))
      .join(", "),
  }));

  const columns: Column<Row>[] = [
    {
      key: "purpose",
      header: "Visit",
      cell: (r) => (
        <Link
          href={`/admin/me/visits/${r.id}`}
          className="text-primary font-medium hover:underline"
        >
          {r.purpose}
        </Link>
      ),
    },
    {
      key: "organisation",
      header: "Organisation",
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
      mobile: "meta",
      cell: (r) => <span className="text-muted-foreground">{r.date}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My visits"
        description="Trips you were on. Record one and claim its costs from it."
        action={
          <FormPanelButton
            label="Record visit"
            title="Record a visit"
            description="A trip out. You are on it; tick anyone who came along."
          >
            <VisitForm
              people={people}
              leads={(leads?.items ?? []).map((l) => ({
                id: String(l._id),
                label: `${l.organisation} (${l.code})`,
              }))}
              endpoint="/api/admin/me/visits"
              afterHref="/admin/me/visits"
              lockedAttendeeId={me}
            />
          </FormPanelButton>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search purpose, organisation, reference…" }}
        total={page.total}
        countLabel={`${page.total} visit${page.total === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No visits yet — record your first trip."
        minWidth={720}
      />
      {page.pages > 1 && (
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
