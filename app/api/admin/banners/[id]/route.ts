import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { bannerUpdateSchema } from "@/lib/schemas/banner";
import { updateBanner, deleteBanner } from "@/lib/repositories/banners.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, bannerUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const doc = await updateBanner(id, parsed.data);
  if (!doc) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "banner.update",
    entityType: "Banner",
    entityId: id,
    after: parsed.data,
  });
  return ok({ id });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  await deleteBanner(id);
  await writeAudit({
    actorId: admin.sub,
    action: "banner.delete",
    entityType: "Banner",
    entityId: id,
  });
  return ok({ id });
}
