import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { recordOrderPayment } from "@/lib/services/order.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

const recordPaymentSchema = z.object({
  txnId: z.string().trim().max(120).optional(),
  note: z.string().trim().max(1000).optional(),
});

/**
 * Mark a COD or credit order as PAID without changing its fulfilment status —
 * these ship before the money arrives, so payment can't ride the status
 * machine. 409 when the order isn't in a recordable state (wrong method,
 * already paid, or cancelled/refunded).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, recordPaymentSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await recordOrderPayment(id, parsed.data);
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: "order.payment_recorded",
    entityType: "Order",
    entityId: id,
    after: {
      method: result.order.payment.method ?? "offline",
      txnId: parsed.data.txnId ?? null,
    },
  });
  return ok({ paidAt: result.order.payment.paidAt });
}
