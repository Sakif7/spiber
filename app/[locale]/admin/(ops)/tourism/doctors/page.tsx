import { setRequestLocale } from "next-intl/server";
import { listDoctors } from "@/lib/repositories/doctors.repo";
import { listHospitals } from "@/lib/repositories/hospitals.repo";
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
import { DoctorForm } from "@/components/admin/tourism/catalog-form";

export const dynamic = "force-dynamic";

const LIST: ListConfig = {
  ...CATALOG_LIST,
  filters: [...(CATALOG_LIST.filters ?? []), "online", "hospital"],
};

export default async function AdminDoctorsPage({
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
  const onlineConsultation =
    query.filters.online === "1"
      ? true
      : query.filters.online === "0"
        ? false
        : undefined;

  let rows: CatalogRow[] = [];
  let total = 0;
  let pages = 1;
  let hospitalOptions: { value: string; label: string }[] = [];
  try {
    const [res, hospitals] = await Promise.all([
      listDoctors({
        status,
        onlineConsultation,
        hospitalId: query.filters.hospital,
        search: query.q || undefined,
        sort: query.sort,
        dir: query.dir,
        from: query.filters.from,
        to: query.filters.to,
        page: query.page,
        pageSize: query.pageSize,
      }),
      listHospitals({ pageSize: 100, sort: "name", dir: "asc" }),
    ]);
    total = res.total;
    pages = res.pages;
    rows = res.items.map((r) => ({
      id: String(r._id),
      // Small documents, so the list carries them and the edit panel
      // opens instantly instead of fetching one.
      initial: JSON.parse(JSON.stringify(r)) as Record<string, unknown>,
      title: r.name,
      slug: r.slug,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      meta: localize(r.specialty, l),
    }));
    hospitalOptions = hospitals.items.map((h) => ({
      value: String(h._id),
      label: localize(h.name, l),
    }));
  } catch {
    rows = [];
  }

  const newAction = (
    <FormPanelButton
      label="New doctor"
      title="New doctor"
      description="A specialist profile for consultation and referral."
    >
      <DoctorForm />
    </FormPanelButton>
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Doctors"
        description="Specialist profiles available for consultation and referral."
        action={newAction}
      />
      <CatalogList
        rows={rows}
        newAction={newAction}
        editTitle="Edit doctor"
        renderEdit={(r) => <DoctorForm id={r.id} initial={r.initial} />}
        noun="doctors"
        nounSingular="doctor"
        metaHeader="Specialty"
        query={query}
        total={total}
        pages={pages}
        filters={[
          {
            param: "online",
            label: "Teleconsult",
            kind: "pills",
            options: [
              { value: "1", label: "Offers teleconsult" },
              { value: "0", label: "In person only" },
            ],
          },
          ...(hospitalOptions.length > 0
            ? [
                {
                  param: "hospital",
                  label: "Hospital",
                  kind: "select" as const,
                  options: hospitalOptions,
                  allLabel: "All hospitals",
                },
              ]
            : []),
        ]}
        searchPlaceholder="Search doctor name or specialty…"
        emptyHint="Doctors appear on hospital pages and can be booked for teleconsultation. Create the first profile to start the network."
      />
    </div>
  );
}
