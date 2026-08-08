import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { sellerSettingsUpdateSchema } from "@/lib/schemas/seller";
import { setSellerCommissionBp } from "@/lib/services/seller-settings.service";
import { setCategoryCommissionRates } from "@/lib/repositories/taxonomy.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

/**
 * Seller-commission settings: the GLOBAL default rate and/or PER-CATEGORY
 * rates (both in basis points; a null category rate clears it back to inherit).
 */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, sellerSettingsUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const { commissionBp, categoryRates } = parsed.data;
  let categoriesUpdated = 0;
  if (typeof commissionBp === "number") {
    await setSellerCommissionBp(commissionBp);
  }
  if (categoryRates && categoryRates.length > 0) {
    categoriesUpdated = await setCategoryCommissionRates(categoryRates);
  }

  await writeAudit({
    actorId: admin.sub,
    action: "seller.settings",
    entityType: "Setting",
    after: {
      ...(typeof commissionBp === "number" ? { commissionBp } : {}),
      ...(categoryRates?.length
        ? { categoryRates: categoryRates.length, categoriesUpdated }
        : {}),
    },
  });
  return ok({ commissionBp: commissionBp ?? null, categoriesUpdated });
}
