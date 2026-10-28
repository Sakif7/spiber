import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { feeRateVersionInputSchema } from "@/lib/schemas/payment";
import {
  removeFeeRateVersion,
  saveFeeRateVersion,
} from "@/lib/services/payment-settings.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Save one set of PayStation fee rates, in force from a day. */
export async function PUT(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, feeRateVersionInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const settings = await saveFeeRateVersion(parsed.data);
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.fee_rates.save",
      entityType: "Setting",
      entityId: "payments",
      after: parsed.data,
    },
    req,
  );
  return ok(settings);
}

const removeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Drop one set; fees already taken keep what they were frozen at. */
export async function DELETE(req: Request) {
  const admin = await requireSuperAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, removeSchema);
  if (!parsed.success) return fail({ code: "invalid_input" }, 400);
  const res = await removeFeeRateVersion(parsed.data.from);
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "last_rates_in_use"
            ? "Online payment is switched on somewhere; the last set of rates cannot go."
            : "No rates start that day.",
      },
      res.code === "not_found" ? 404 : 409,
    );
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.fee_rates.remove",
      entityType: "Setting",
      entityId: "payments",
      after: parsed.data,
    },
    req,
  );
  return ok(res.settings);
}
