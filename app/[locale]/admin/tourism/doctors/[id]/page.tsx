import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DoctorForm } from "@/components/admin/tourism/catalog-form";
import { getDoctorByIdLean } from "@/lib/repositories/doctors.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function EditDoctorPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const doc = await getDoctorByIdLean(id).catch(() => null);
  if (!doc) notFound();
  const initial = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/doctors"
        backLabel="Doctors"
        title="Edit doctor"
      />
      <DoctorForm id={id} initial={initial} />
    </div>
  );
}
