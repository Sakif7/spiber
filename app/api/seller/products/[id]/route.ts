import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSeller } from "@/lib/auth/guard";
import { sellerProductSchema } from "@/lib/schemas/seller-product";
import {
  updateSellerProduct,
  softDeleteSellerProduct,
} from "@/lib/services/seller-product.service";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSeller();
  if (!session) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, sellerProductSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const result = await updateSellerProduct(
    String(session.seller._id),
    session.claims.sub,
    id,
    parsed.data,
  );
  if (!result.ok) return fail({ code: result.code }, 404);
  return ok({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSeller();
  if (!session) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const r = await softDeleteSellerProduct(String(session.seller._id), id);
  if (!r.ok) return fail({ code: "not_found" }, 404);
  return ok({ ok: true });
}
