import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { expenseCreateSchema } from "@/lib/schemas/expense";
import { createExpense } from "@/lib/services/hr/expense.service";
import { myVisit } from "@/lib/services/me.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardMe } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * Record a claim from the portal. The claimant is always the signed-in
 * employee (the body's `employeeId` is ignored), and a visit may only be
 * attached if they were on it. Approval stays with the super admin.
 */
export async function POST(req: Request) {
  const g = await guardMe("claim-create", 30);
  if (!g.ok) return g.res;

  const parsed = await parseJson(
    req,
    expenseCreateSchema.omit({ employeeId: true }),
  );
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (parsed.data.visitId && !(await myVisit(g.session, parsed.data.visitId))) {
    return fail({ code: "visit_not_yours" }, 403);
  }

  const expense = await createExpense(
    { ...parsed.data, employeeId: String(g.session.employee._id) },
    g.actor,
  );
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "expense.create",
      entityType: "Expense",
      entityId: String(expense._id),
      after: {
        ref: expense.ref,
        amountMinor: expense.amountMinor,
        category: expense.category,
        via: "portal",
      },
    },
    req,
  );
  return ok({ id: String(expense._id), ref: expense.ref });
}
