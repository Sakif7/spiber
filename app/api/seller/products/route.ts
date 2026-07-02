import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSeller } from "@/lib/auth/guard";
import { sellerProductSchema } from "@/lib/schemas/seller-product";
import { createSellerProduct } from "@/lib/services/seller-product.service";

export const dynamic = "force-dynamic";

/** Create a seller-owned product (pending admin approval). */
export async function POST(req: Request) {
  const session = await requireSeller();
  if (!session) return fail({ code: "forbidden" }, 403);

  const parsed = await parseJson(req, sellerProductSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const id = await createSellerProduct(
    String(session.seller._id),
    session.claims.sub,
    parsed.data,
  );
  return ok({ id });
}
