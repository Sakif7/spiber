import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { salaryPaidThroughSchema } from "@/lib/schemas/hr";
import { setSalaryPaidThrough } from "@/lib/services/hr/payout.service";
import { getEmployee } from "@/lib/services/hr/employee.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * Record that someone's salary was already paid up to a day — outside the
 * system, before they were put on it — so their first payout does not pay
 * those days again.
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, salaryPaidThroughSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const before = await getEmployee(id);
  if (!before) return fail({ code: "not_found" }, 404);
  const res = await setSalaryPaidThrough(id, parsed.data.through, g.actor);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "not_found" ? 404 : 409);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.salaryPaidThrough",
      entityType: "Employee",
      entityId: id,
      before: { salaryPaidThrough: before.salaryPaidThrough ?? null },
      after: { salaryPaidThrough: res.data.salaryPaidThrough },
    },
    req,
  );
  return ok({ id, salaryPaidThrough: res.data.salaryPaidThrough });
}
