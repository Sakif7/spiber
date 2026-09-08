import { ok, fail } from "@/lib/http/respond";
import {
  expenseUpdateSchema,
  expenseApproveSchema,
  expenseRejectSchema,
  expenseReimburseSchema,
} from "@/lib/schemas/expense";
import {
  updateExpense,
  approveExpense,
  rejectExpense,
  reimburseDirect,
  deleteExpense,
} from "@/lib/services/hr/expense.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardPeople, peopleStatus } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * One endpoint, four actions, chosen by an explicit `action` field.
 *
 * Approving, rejecting and paying each carry their own rules and their own
 * audit entry, so they are never inferred from which fields happen to be
 * present.
 */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardPeople("expense-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const action =
    body && typeof body === "object" && "action" in body
      ? String((body as { action: unknown }).action)
      : "update";

  if (action === "approve") {
    const parsed = expenseApproveSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
    }
    const res = await approveExpense(id, parsed.data, g.actor);
    if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "expense.approve",
        entityType: "Expense",
        entityId: id,
        after: {
          settlement: res.data.settlement,
          payrollMonth: res.data.payrollMonth,
        },
      },
      req,
    );
    return ok({
      id,
      settlement: res.data.settlement,
      payrollMonth: res.data.payrollMonth,
    });
  }

  if (action === "reject") {
    const parsed = expenseRejectSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
    }
    const res = await rejectExpense(id, parsed.data, g.actor);
    if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "expense.reject",
        entityType: "Expense",
        entityId: id,
        after: { reason: parsed.data.reason },
      },
      req,
    );
    return ok({ id, status: "rejected" });
  }

  if (action === "reimburse") {
    const parsed = expenseReimburseSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
    }
    const res = await reimburseDirect(id, parsed.data, g.actor);
    if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "expense.reimburse",
        entityType: "Expense",
        entityId: id,
        after: {
          method: parsed.data.method,
          reference: parsed.data.reference ?? null,
        },
      },
      req,
    );
    return ok({ id, status: "reimbursed" });
  }

  const parsed = expenseUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }
  const res = await updateExpense(id, parsed.data);
  if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "expense.update",
      entityType: "Expense",
      entityId: id,
      after: parsed.data,
    },
    req,
  );
  return ok({ id });
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardPeople("expense-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const res = await deleteExpense(id);
  if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "expense.delete",
      entityType: "Expense",
      entityId: id,
    },
    req,
  );
  return ok({ id });
}
