import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { sellerStatusUpdateSchema } from "@/lib/schemas/seller";
import { setSellerStatus } from "@/lib/repositories/sellers.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, sellerStatusUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await setSellerStatus(id, parsed.data.status);
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: `seller.${parsed.data.status}`,
    entityType: "Seller",
    entityId: id,
    after: { status: parsed.data.status },
  });
  return ok({ status: parsed.data.status });
}
