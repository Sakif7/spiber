import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { HospitalForm } from "@/components/admin/tourism/catalog-form";
import { getHospitalByIdLean } from "@/lib/repositories/hospitals.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function EditHospitalPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const doc = await getHospitalByIdLean(id).catch(() => null);
  if (!doc) notFound();
  const initial = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/hospitals"
        backLabel="Hospitals"
        title="Edit hospital"
      />
      <HospitalForm id={id} initial={initial} />
    </div>
  );
}
