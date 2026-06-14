import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { CatalogTable } from "@/components/admin/tourism/catalog-list";
import { listDestinations } from "@/lib/repositories/destinations.repo";
import { localize } from "@/lib/schemas/localized";
import { asLocale } from "@/lib/i18n/intl-locale";

export const dynamic = "force-dynamic";

export default async function AdminDestinationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const l = asLocale(locale);

  let rows: Awaited<ReturnType<typeof listDestinations>>["items"] = [];
  try {
    rows = (await listDestinations({ pageSize: 200 })).items;
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Destinations"
        description="Countries and regions featured for medical travel."
        action={
          <Button asChild>
            <Link href="/admin/tourism/destinations/new">
              <Plus className="size-4" />
              New destination
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
        base="/admin/tourism/destinations"
        empty="No destinations yet."
      />
    </div>
  );
}
