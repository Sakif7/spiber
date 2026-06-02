import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { shippingSettingsSchema } from "@/lib/schemas/settings";
import { setShippingSettings } from "@/lib/services/shop-settings.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, shippingSettingsSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  await setShippingSettings(parsed.data);
  await writeAudit({
    actorId: admin.sub,
    action: "settings.shipping",
    entityType: "Setting",
    entityId: "shipping",
    after: parsed.data,
  });
  return ok({});
}
