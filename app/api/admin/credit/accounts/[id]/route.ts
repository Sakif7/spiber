import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { creditAccountUpdateSchema } from "@/lib/schemas/credit";
import { updateCreditAccount } from "@/lib/repositories/credit-accounts.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

/**
 * Edit a live credit account: net terms, suspend/reactivate, admin notes.
 * Suspending takes effect on the buyer's very next checkout — placeOrder reads
 * the account fresh, so there is no cache or token to invalidate.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, creditAccountUpdateSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);

  const updated = await updateCreditAccount(id, parsed.data);
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "creditAccount.update",
    entityType: "CreditAccount",
    entityId: id,
    after: parsed.data,
  });
  return ok({});
}
