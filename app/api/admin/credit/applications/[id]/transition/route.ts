import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { creditApplicationTransitionSchema } from "@/lib/schemas/credit";
import { transitionCreditApplication } from "@/lib/services/credit.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Approving provisions the CreditAccount (idempotent) and emails the buyer. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, creditApplicationTransitionSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const result = await transitionCreditApplication(id, parsed.data.to, {
    note: parsed.data.note,
    termsDays: parsed.data.termsDays,
    actorId: admin.sub,
  });
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }
  await writeAudit({
    actorId: admin.sub,
    action: `creditApplication.${parsed.data.to}`,
    entityType: "CreditApplication",
    entityId: id,
    after: { to: parsed.data.to, termsDays: parsed.data.termsDays ?? null },
  });
  return ok({ status: parsed.data.to });
}
