import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { payoutCreateSchema } from "@/lib/schemas/hr";
import { payPeople } from "@/lib/services/hr/payout.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * Pay people for a period of their schedule. The amounts are worked out on
 * the server; each person gets their own payout, and the response says how
 * each one went.
 */
export async function POST(req: Request) {
  const g = await guardSales("hr-pay", 30);
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, payoutCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await payPeople(parsed.data, g.actor);
  if (!res.ok) {
    return fail(
      { code: res.code },
      res.code === "bad_schedule" || res.code === "bad_period" ? 404 : 409,
    );
  }

  for (const o of res.data.filter((x) => x.ok)) {
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "payroll.payout.paid",
        entityType: "PayrollPayout",
        entityId: o.payoutId,
        after: {
          ref: o.ref,
          employeeId: o.employeeId,
          totalMinor: o.totalMinor,
          schedule: parsed.data.schedule,
          periodKey: parsed.data.periodKey,
          method: parsed.data.method,
          reference: parsed.data.reference || null,
        },
      },
      req,
    );
  }
  return ok({ outcomes: res.data });
}
