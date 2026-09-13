import { setRequestLocale } from "next-intl/server";
import { listHospitals } from "@/lib/repositories/hospitals.repo";
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
import { HospitalForm } from "@/components/admin/tourism/catalog-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  ...CATALOG_LIST,
  filters: [...(CATALOG_LIST.filters ?? []), "destination"],
};

export default async function AdminHospitalsPage({
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

  let rows: CatalogRow[] = [];
  let total = 0;
  let pages = 1;
  let destinationOptions: { value: string; label: string }[] = [];
  try {
    const [res, destinations] = await Promise.all([
      listHospitals({
        status,
        destinationId: query.filters.destination,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      listDestinations({ pageSize: 100, sort: "name", dir: "asc" }),
    ]);
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
      meta: [r.city ? localize(r.city, l) : "", localize(r.country, l)]
        .filter(Boolean)
        .join(", "),
    }));
    destinationOptions = destinations.items.map((d) => ({
      value: String(d._id),
      label: localize(d.name, l),
    }));
  } catch {
    rows = [];
  }

  const newAction = (
    <FormPanelButton
      label="New hospital"
      title="New hospital"
      description="A partner hospital or clinic patients can be referred to."
    >
      <HospitalForm />
    </FormPanelButton>
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Hospitals"
        description="Partner hospitals and clinics patients can be referred to."
        action={newAction}
      />
      <CatalogList
        rows={rows}
        newAction={newAction}
        editTitle="Edit hospital"
        renderEdit={(r) => <HospitalForm id={r.id} initial={r.initial} />}
        noun="hospitals"
        nounSingular="hospital"
        metaHeader="Location"
        query={query}
        total={total}
        pages={pages}
        filters={
          destinationOptions.length > 0
            ? [
                {
                  param: "destination",
                  label: "Destination",
                  kind: "select",
                  options: destinationOptions,
                  allLabel: "All destinations",
                },
              ]
            : []
        }
        searchPlaceholder="Search hospital, city, country…"
        emptyHint="Hospitals appear on destination pages and in package details. Create the first one to start the network."
      />
    </div>
  );
}
