import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { CatalogTable } from "@/components/admin/tourism/catalog-list";
import { listPackages } from "@/lib/repositories/packages.repo";
import { localize } from "@/lib/schemas/localized";
import { asLocale } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

export default async function AdminPackagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = asLocale(locale);

  let rows: Awaited<ReturnType<typeof listPackages>>["items"] = [];
  try {
    rows = (await listPackages({ pageSize: 200 })).items;
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Packages"
        description="Treatment and health-check packages with cost estimates."
        action={
          <Button asChild>
            <Link href="/admin/tourism/packages/new">
              <Plus className="size-4" />
              New package
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
        base="/admin/tourism/packages"
        empty="No packages yet."
      />
    </div>
  );
}
