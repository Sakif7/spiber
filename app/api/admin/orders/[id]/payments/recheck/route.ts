import mongoose from "mongoose";
import { ok, fail } from "@/lib/http/respond";
import { requireAdmin } from "@/lib/auth/guard";
import { recheckOrderPayments } from "@/lib/services/payment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Re-check with PayStation: ask the gateway about every try on this order
 * that could still be money, and apply what it says. For an order a customer
 * says they paid while it still shows unpaid.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) return fail({ code: "not_found" }, 404);

  let result;
  try {
    result = await recheckOrderPayments(id);
  } catch (e) {
    logger.error(`re-check of order ${id} could not reach the gateway`, e);
    return fail({ code: "gateway_unreachable" }, 502);
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.recheck",
      entityType: "Order",
      entityId: id,
      after: result,
    },
    req,
  );
  return ok(result);
}
