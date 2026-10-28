import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { adsenseSettingsSchema } from "@/lib/schemas/settings";
import {
  getAdsenseSettings,
  setAdsenseSettings,
} from "@/lib/services/ads-settings.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/**
 * Google AdSense on blog posts. Super admin only: the publisher ID decides
 * who Google pays for every ad the site shows.
 */
export async function PUT(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, adsenseSettingsSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const before = await getAdsenseSettings();
  await setAdsenseSettings(parsed.data);
  await writeAudit(
    {
      actorId: admin.sub,
      action: "settings.adsense",
      entityType: "Setting",
      entityId: "adsense",
      before,
      after: parsed.data,
    },
    req,
  );
  // As stored (`ca-pub-…` comes back `pub-…`), so the form shows the truth.
  return ok(parsed.data);
}
