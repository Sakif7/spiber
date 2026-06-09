import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { galleryAlbumSchema } from "@/lib/schemas/gallery";
import { saveAlbum } from "@/lib/services/gallery.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Create a gallery album. */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, galleryAlbumSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await saveAlbum(parsed.data);
  if (!result.ok) return fail({ code: result.code }, 409);

  await writeAudit({
    actorId: admin.sub,
    action: "gallery.create",
    entityType: "GalleryAlbum",
    entityId: result.id,
    after: { slug: result.slug, status: parsed.data.status },
  });

  return ok({ id: result.id, slug: result.slug });
}
