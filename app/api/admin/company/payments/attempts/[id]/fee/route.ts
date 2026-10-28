import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { paymentFeeCorrectionSchema } from "@/lib/schemas/payment";
import { correctAttemptFee } from "@/lib/services/payment-admin.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Set one payment's fee to what PayStation's statement says. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireSuperAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, paymentFeeCorrectionSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await correctAttemptFee(id, parsed.data, admin.sub);
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "no_fee"
            ? "Only a payment the gateway actually took carries a fee."
            : undefined,
      },
      res.code === "not_found" ? 404 : 409,
    );
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.fee_corrected",
      entityType: "PaymentAttempt",
      entityId: id,
      after: { feeMinor: parsed.data.feeMinor, note: parsed.data.note },
    },
    req,
  );
  return ok({ feeMinor: res.attempt.feeMinor });
}
