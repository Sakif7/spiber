import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { medtradeCommerceSettingsSchema } from "@/lib/schemas/settings";
import { setMedtradeCommerceSettings } from "@/lib/services/shop-settings.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Medtrade VAT (charged) + AIT (invoice note only) rates, in basis points. */
export async function PUT(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, medtradeCommerceSettingsSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  await setMedtradeCommerceSettings(parsed.data);
  await writeAudit({
    actorId: admin.sub,
    action: "settings.medtradeCommerce",
    entityType: "Setting",
    entityId: "medtradeCommerce",
    after: parsed.data,
  });
  return ok({});
}
