import { slugify } from "@/lib/slug";
import { createAlbum, updateAlbum } from "@/lib/repositories/gallery.repo";
import type { GalleryAlbumInput } from "@/lib/schemas/gallery";
import type { IGalleryAlbum } from "@/lib/models/galleryAlbum";

export type SaveAlbumResult =
  | { ok: true; id: string; slug: string }
  | { ok: false; code: "duplicate" | "not_found" };

function isDuplicateKeyError(e: unknown): boolean {
  return (e as { code?: number } | null)?.code === 11000;
}

/**
 * Create or update a gallery album. Derives the slug from `slug || title.en`
 * and defaults the cover image to the first photo when none is set. Duplicate
 * slugs (unique index) are returned as a typed result, not thrown.
 */
export async function saveAlbum(
  input: GalleryAlbumInput,
  id?: string,
): Promise<SaveAlbumResult> {
  const slug = slugify(input.slug || input.title.en);
  const data: Partial<IGalleryAlbum> = {
    title: input.title,
    slug,
    description: input.description,
    coverImage: input.coverImage || input.images[0]?.url || undefined,
    date: input.date ?? null,
    images: input.images,
    status: input.status,
  };
  try {
    if (id) {
      const updated = await updateAlbum(id, data);
      if (!updated) return { ok: false, code: "not_found" };
      return { ok: true, id: String(updated._id), slug: updated.slug };
    }
    const created = await createAlbum(data);
    return { ok: true, id: String(created._id), slug: created.slug };
  } catch (e) {
    if (isDuplicateKeyError(e)) return { ok: false, code: "duplicate" };
    throw e;
  }
}
