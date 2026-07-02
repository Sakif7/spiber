import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSeller } from "@/lib/auth/guard";
import { sellerProfileUpdateSchema } from "@/lib/schemas/seller";
import { updateSellerByUserId } from "@/lib/repositories/sellers.repo";

export const dynamic = "force-dynamic";

/** Update the signed-in seller's own shop profile + bank details. */
export async function PATCH(req: Request) {
  const session = await requireSeller();
  if (!session) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, sellerProfileUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  await updateSellerByUserId(session.claims.sub, parsed.data);
  return ok({ ok: true });
}
