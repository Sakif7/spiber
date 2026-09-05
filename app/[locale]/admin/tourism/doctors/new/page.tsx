import { setRequestLocale } from "next-intl/server";
import { DoctorForm } from "@/components/admin/tourism/catalog-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewDoctorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/doctors"
        backLabel="Doctors"
        title="New doctor"
      />
      <DoctorForm />
    </div>
  );
}
