import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DestinationForm } from "@/components/admin/tourism/catalog-form";
import { getDestinationByIdLean } from "@/lib/repositories/destinations.repo";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function EditDestinationPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const doc = await getDestinationByIdLean(id).catch(() => null);
  if (!doc) notFound();
  const initial = JSON.parse(JSON.stringify(doc)) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/destinations"
        backLabel="Destinations"
        title="Edit destination"
      />
      <DestinationForm id={id} initial={initial} />
    </div>
  );
}
