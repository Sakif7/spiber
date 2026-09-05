import { setRequestLocale } from "next-intl/server";

import { BrandForm } from "@/components/admin/brand-form";
import { BrandList, type BrandRow } from "@/components/admin/brand-list";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listBrands } from "@/lib/repositories/taxonomy.repo";
import { localize } from "@/lib/schemas/localized";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  let brands: BrandRow[] = [];
  try {
    const rows = await listBrands();
    brands = rows.map((b) => ({
      id: String(b._id),
      nameEn: localize(b.name, "en"),
      nameBn: b.name?.bn ?? "",
      nameJa: b.name?.ja ?? "",
      slug: b.slug,
      logo: b.logo,
    }));
  } catch {
    brands = [];
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Brands"
        description="Shared by Medtrade and Spiber Kart. The order here drives the brand filters, the storefront brand strip and the “By brand” navigation menu."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <Card className="order-2 gap-0 overflow-hidden py-0 lg:order-1">
          <CardHeader className="border-b px-4 py-3">
            <CardTitle className="text-sm">
              {brands.length} brand{brands.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription>
              Reorder with the arrows, or click Edit on a row to change its
              name, slug or logo.
            </CardDescription>
          </CardHeader>
          <BrandList brands={brands} />
        </Card>

        <Card className="order-1 lg:order-2">
          <CardHeader>
            <CardTitle className="text-sm">Add brand</CardTitle>
            <CardDescription>
              New brands are appended to the end of the order.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BrandForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
