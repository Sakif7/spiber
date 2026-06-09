import { setRequestLocale } from "next-intl/server";
import { AlbumForm } from "@/components/admin/gallery/album-form";

export const dynamic = "force-dynamic";

export default async function NewAlbumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div style={{ display: "grid", gap: "var(--s-6)" }}>
      <h1
        style={{
          margin: 0,
          fontFamily: "var(--font-display)",
          fontSize: "var(--fs-2xl)",
          color: "var(--color-text-strong)",
        }}
      >
        New album
      </h1>
      <AlbumForm />
    </div>
  );
}
