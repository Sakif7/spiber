import { setRequestLocale } from "next-intl/server";
import { listDestinations } from "@/lib/repositories/destinations.repo";
import { asLocale } from "@/lib/i18n/intl-locale";
import { localize } from "@/lib/schemas/localized";
import {
  tourismStatusEnum,
  type TourismStatus,
} from "@/lib/schemas/tourism-catalog";
import {
  parseListQuery,
  type ListConfig,
  type SearchParamsInput,
} from "@/lib/admin/list-params";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  CATALOG_LIST,
  CatalogList,
  type CatalogRow,
} from "@/components/admin/tourism/catalog-list";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { DestinationForm } from "@/components/admin/tourism/catalog-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  ...CATALOG_LIST,
  filters: [...(CATALOG_LIST.filters ?? []), "featured"],
};

export default async function AdminDestinationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParamsInput>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = asLocale(locale);

  const query = parseListQuery(await searchParams, LIST);
  const status = tourismStatusEnum.options.includes(
    query.filters.status as TourismStatus,
  )
    ? (query.filters.status as TourismStatus)
    : undefined;
  const featured = query.filters.featured === "1" ? true : undefined;

  let rows: CatalogRow[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listDestinations({
      status,
      featured,
      search: query.q || undefined,
      sort: query.sort,
      dir: query.dir,
      from: query.filters.from,
      to: query.filters.to,
      page: query.page,
      pageSize: query.pageSize,
    });
    total = res.total;
    pages = res.pages;
    rows = res.items.map((r) => ({
      id: String(r._id),
      // Small documents, so the list carries them and the edit panel
      // opens instantly instead of fetching one.
      initial: JSON.parse(JSON.stringify(r)) as Record<string, unknown>,
      title: localize(r.name, l),
      slug: r.slug,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      meta: r.featured ? "Featured" : "",
    }));
  } catch {
    rows = [];
  }

  const newAction = (
    <FormPanelButton
      label="New destination"
      title="New destination"
      description="A country or region featured for medical travel."
    >
      <DestinationForm />
    </FormPanelButton>
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Destinations"
        description="Countries and regions featured for medical travel."
        action={newAction}
      />
      <CatalogList
        rows={rows}
        newAction={newAction}
        editTitle="Edit destination"
        renderEdit={(r) => <DestinationForm id={r.id} initial={r.initial} />}
        noun="destinations"
        nounSingular="destination"
        metaHeader="Featured"
        query={query}
        total={total}
        pages={pages}
        filters={[
          {
            param: "featured",
            label: "Featured",
            kind: "pills",
            options: [{ value: "1", label: "Featured only" }],
          },
        ]}
        searchPlaceholder="Search destination name…"
        emptyHint="Destinations are the countries and regions patients can travel to. Create the first one to start the catalog."
      />
    </div>
  );
}
