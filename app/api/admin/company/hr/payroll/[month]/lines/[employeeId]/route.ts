import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { payrollLinePaidSchema } from "@/lib/schemas/hr";
import { markLinePaid } from "@/lib/services/hr/payroll.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../../../sales/_guard";

export const dynamic = "force-dynamic";

/** Record that one director has actually been paid. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ month: string; employeeId: string }> },
) {
  const g = await guardSales("hr-write", 60);
  if (!g.ok) return g.res;
  const { month, employeeId } = await params;

  const parsed = await parseJson(req, payrollLinePaidSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await markLinePaid(month, employeeId, parsed.data, g.actor);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "not_found" ? 404 : 409);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "payroll.line.paid",
      entityType: "PayrollRun",
      entityId: month,
      after: { employeeId, reference: parsed.data.reference ?? null },
    },
    req,
  );
  return ok({ month, employeeId });
}
