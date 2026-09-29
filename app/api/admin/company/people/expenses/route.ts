import { ok, fail } from "@/lib/http/respond";
import { expenseCreateSchema } from "@/lib/schemas/expense";
import { createExpense } from "@/lib/services/hr/expense.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardPeople } from "../_guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardPeople("expense-write");
  if (!g.ok) return g.res;

  const parsed = expenseCreateSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }

  const expense = await createExpense(parsed.data, g.actor);
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "expense.create",
      entityType: "Expense",
      entityId: String(expense._id),
      after: {
        ref: expense.ref,
        amountMinor: expense.amountMinor,
        lines: expense.lines?.length ?? 1,
      },
    },
    req,
  );
  return ok(
    { id: String(expense._id), ref: expense.ref },
    {
      status: 201,
    },
  );
}
