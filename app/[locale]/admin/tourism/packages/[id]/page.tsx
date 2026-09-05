import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PackageForm } from "@/components/admin/tourism/catalog-form";
import { getPackageByIdLean } from "@/lib/repositories/packages.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function EditPackagePage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const doc = await getPackageByIdLean(id).catch(() => null);
  if (!doc) notFound();
  const initial = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/packages"
        backLabel="Packages"
        title="Edit package"
      />
      <PackageForm id={id} initial={initial} />
    </div>
  );
}
