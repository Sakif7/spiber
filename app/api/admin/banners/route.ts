import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { bannerSchema } from "@/lib/schemas/banner";
import { createBanner } from "@/lib/repositories/banners.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, bannerSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const doc = await createBanner(parsed.data);
  await writeAudit({
    actorId: admin.sub,
    action: "banner.create",
    entityType: "Banner",
    entityId: String(doc._id),
    after: parsed.data,
  });
  return ok({ id: String(doc._id) });
}
