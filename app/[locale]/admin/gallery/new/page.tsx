import { setRequestLocale } from "next-intl/server";
import { AlbumForm } from "@/components/admin/gallery/album-form";
import { EditorHeader } from "@/components/admin/ui/form-shell";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/gallery"
        backLabel="Gallery"
        title="New album"
      />
      <AlbumForm />
    </div>
  );
}
