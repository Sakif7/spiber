import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { paymentSettingsPatchSchema } from "@/lib/schemas/payment";
import { updatePaymentSettings } from "@/lib/services/payment-settings.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Where online payment is offered, and EMI. Super admin only. */
export async function PATCH(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, paymentSettingsPatchSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await updatePaymentSettings(parsed.data);
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "fee_rates_missing"
            ? "Enter PayStation's fee rates before switching a payment point on — every payment's fee is a cost in the sales report."
            : "That payment point is not built yet.",
      },
      409,
    );
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.settings",
      entityType: "Setting",
      entityId: "payments",
      after: parsed.data,
    },
    req,
  );
  return ok(res.settings);
}
