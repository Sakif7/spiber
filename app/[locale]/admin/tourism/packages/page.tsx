import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { listPackages } from "@/lib/repositories/packages.repo";
import { asLocale } from "@/lib/i18n/intl-locale";
import { localize } from "@/lib/schemas/localized";
import {
  tourismStatusEnum,
  treatmentCategoryEnum,
  type TourismStatus,
  type TreatmentCategory,
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

export const dynamic = "force-dynamic";

const CATEGORIES = treatmentCategoryEnum.options;
const CATEGORY_LABEL: Record<TreatmentCategory, string> = {
  cardiac: "Cardiac",
  ortho: "Orthopaedic",
  neuro: "Neurology",
  oncology: "Oncology",
  ivf: "IVF",
  cosmetic: "Cosmetic",
  "health-check": "Health check",
};

const LIST: ListConfig = {
  ...CATALOG_LIST,
  filters: [...(CATALOG_LIST.filters ?? []), "category"],
};

export default async function AdminPackagesPage({
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
  const category = CATEGORIES.includes(
    query.filters.category as TreatmentCategory,
  )
    ? (query.filters.category as TreatmentCategory)
    : undefined;

  let rows: CatalogRow[] = [];
  let total = 0;
  let pages = 1;
  try {
    const res = await listPackages({
      status,
      category,
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
      title: localize(r.name, l),
      slug: r.slug,
      status: r.status,
      createdAt: new Date(r.createdAt).toISOString(),
      meta: CATEGORY_LABEL[r.category as TreatmentCategory] ?? r.category,
    }));
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Packages"
        description="Treatment packages bundling procedure, stay and travel."
        action={
          <Button asChild size="sm">
            <Link href="/admin/tourism/packages/new">
              <Plus className="size-4" />
              New package
            </Link>
          </Button>
        }
      />
      <CatalogList
        rows={rows}
        base="/admin/tourism/packages"
        noun="packages"
        nounSingular="package"
        metaHeader="Category"
        query={query}
        total={total}
        pages={pages}
        filters={[
          {
            param: "category",
            label: "Category",
            kind: "pills",
            options: CATEGORIES.map((c) => ({
              value: c,
              label: CATEGORY_LABEL[c],
            })),
          },
        ]}
        searchPlaceholder="Search package name…"
        emptyHint="Packages bundle treatment, stay and travel for one procedure. Create the first one to show on the Tourism site."
      />
    </div>
  );
}
