import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { galleryAlbumSchema } from "@/lib/schemas/gallery";
import { saveAlbum } from "@/lib/services/gallery.service";
import { softDeleteAlbum } from "@/lib/repositories/gallery.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Update a gallery album. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, galleryAlbumSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await saveAlbum(parsed.data, id);
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }

  await writeAudit({
    actorId: admin.sub,
    action: "gallery.update",
    entityType: "GalleryAlbum",
    entityId: id,
    after: { slug: result.slug, status: parsed.data.status },
  });

  return ok({ id: result.id, slug: result.slug });
}

/** Soft-delete a gallery album. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  await softDeleteAlbum(id);
  await writeAudit({
    actorId: admin.sub,
    action: "gallery.delete",
    entityType: "GalleryAlbum",
    entityId: id,
  });

  return ok({ id });
}
