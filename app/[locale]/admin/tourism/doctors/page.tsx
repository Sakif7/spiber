import { setRequestLocale } from "next-intl/server";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { CatalogTable } from "@/components/admin/tourism/catalog-list";
import { listDoctors } from "@/lib/repositories/doctors.repo";

export const dynamic = "force-dynamic";

export default async function AdminDoctorsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let rows: Awaited<ReturnType<typeof listDoctors>>["items"] = [];
  try {
    rows = (await listDoctors({ pageSize: 200 })).items;
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Doctors"
        description="Specialist profiles available for consultation and referral."
        action={
          <Button asChild>
            <Link href="/admin/tourism/doctors/new">
              <Plus className="size-4" />
              New doctor
            </Link>
          </Button>
        }
      />
      <CatalogTable
        rows={rows.map((r) => ({
          id: String(r._id),
          title: r.name,
          slug: r.slug,
          status: r.status,
        }))}
        base="/admin/tourism/doctors"
        empty="No doctors yet."
      />
    </div>
  );
}
