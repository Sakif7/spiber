import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { CatalogTable } from "@/components/admin/tourism/catalog-list";
import { listHospitals } from "@/lib/repositories/hospitals.repo";
import { localize } from "@/lib/schemas/localized";
import { asLocale } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

export default async function AdminHospitalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = asLocale(locale);

  let rows: Awaited<ReturnType<typeof listHospitals>>["items"] = [];
  try {
    rows = (await listHospitals({ pageSize: 200 })).items;
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Hospitals"
        description="Partner facilities and accredited treatment centres."
        action={
          <Button asChild>
            <Link href="/admin/tourism/hospitals/new">
              <Plus className="size-4" />
              New hospital
            </Link>
          </Button>
        }
      />
      <CatalogTable
        rows={rows.map((r) => ({
          id: String(r._id),
          title: localize(r.name, l),
          slug: r.slug,
          status: r.status,
        }))}
        base="/admin/tourism/hospitals"
        empty="No hospitals yet."
      />
    </div>
  );
}
