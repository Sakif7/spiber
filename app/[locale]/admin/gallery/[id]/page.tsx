import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  AlbumForm,
  type AlbumFormInitial,
} from "@/components/admin/gallery/album-form";
import { getAlbumByIdLean } from "@/lib/repositories/gallery.repo";

export const dynamic = "force-dynamic";

const L = (v?: { en?: string; bn?: string }) => ({
  en: v?.en ?? "",
  bn: v?.bn ?? "",
});

export default async function EditAlbumPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const album = await getAlbumByIdLean(id).catch(() => null);
  if (!album) notFound();

  const initial: AlbumFormInitial = {
    id: String(album._id),
    title: L(album.title),
    slug: album.slug,
    description: L(album.description),
    coverImage: album.coverImage ?? "",
    date: album.date ? new Date(album.date).toISOString().slice(0, 10) : "",
    images: (album.images ?? []).map((im) => ({
      url: im.url,
      caption: L(im.caption),
    })),
    status: album.status,
  };

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
        Edit album
      </h1>
      <AlbumForm initial={initial} />
    </div>
  );
}
