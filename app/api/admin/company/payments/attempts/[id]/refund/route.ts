import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { paymentRefundSchema } from "@/lib/schemas/payment";
import { recordAttemptRefund } from "@/lib/services/payment-admin.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Record that money waiting under Needs refund was returned by hand. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, paymentRefundSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await recordAttemptRefund(id, parsed.data, admin.sub);
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "not_refundable"
            ? "Only a payment waiting under Needs refund can be recorded as refunded here."
            : undefined,
      },
      res.code === "not_found" ? 404 : 409,
    );
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.refund_recorded",
      entityType: "PaymentAttempt",
      entityId: id,
      after: { reference: parsed.data.reference, note: parsed.data.note },
    },
    req,
  );
  return ok({ status: res.attempt.status });
}
