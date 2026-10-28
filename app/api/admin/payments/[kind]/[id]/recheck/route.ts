import mongoose from "mongoose";
import { ok, fail } from "@/lib/http/respond";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth/guard";
import { recheckSubjectPayments } from "@/lib/services/payment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Which records a Re-check may ask about, by URL segment — and who may: a
 * Sales invoice is the super admins' alone.
 */
const KINDS = {
  software: {
    kinds: ["software"] as const,
    entityType: "SoftwarePurchase",
    superOnly: false,
  },
  enrollment: {
    kinds: ["enrollment"] as const,
    entityType: "Enrollment",
    superOnly: false,
  },
  sales_order: {
    kinds: ["sales_order"] as const,
    entityType: "SalesOrder",
    superOnly: true,
  },
  medical_case: {
    kinds: ["medical_case"] as const,
    entityType: "MedicalCase",
    superOnly: false,
  },
  travel_request: {
    kinds: ["travel_request"] as const,
    entityType: "TravelRequest",
    superOnly: false,
  },
};

/**
 * Re-check with PayStation for a software purchase, an enrollment or a Sales
 * invoice: ask about every try that could still be money and apply what
 * PayStation says.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  const { kind, id } = await params;
  const k = KINDS[kind as keyof typeof KINDS];
  const admin = k?.superOnly ? await requireSuperAdmin() : await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  if (!k || !mongoose.isValidObjectId(id)) {
    return fail({ code: "not_found" }, 404);
  }
  let result;
  try {
    result = await recheckSubjectPayments([...k.kinds], id);
  } catch (e) {
    logger.error(`re-check of ${kind} ${id} could not reach the gateway`, e);
    return fail({ code: "gateway_unreachable" }, 502);
  }
  await writeAudit(
    {
      actorId: admin.sub,
      action: "payment.recheck",
      entityType: k.entityType,
      entityId: id,
      after: result,
    },
    req,
  );
  return ok(result);
}
