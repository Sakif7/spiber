import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { cycleChangeSchema } from "@/lib/schemas/hr";
import {
  getProfitCycle,
  profitCycleFloor,
  setProfitCycle,
} from "@/lib/services/hr/payroll.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/** How often profit is worked out, and the first day a change may start. */
export async function GET() {
  const g = await guardSales("hr-read");
  if (!g.ok) return g.res;
  const [versions, floor] = await Promise.all([
    getProfitCycle(),
    profitCycleFloor(),
  ]);
  return ok({ versions, floor });
}

/**
 * Change the profit cycle from a day. Refused when that day falls inside a
 * period already on record — its figures were worked out on the old cycle.
 */
export async function PUT(req: Request) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, cycleChangeSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const before = await getProfitCycle();
  const res = await setProfitCycle(parsed.data);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "bad_cycle" ? 400 : 409);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "payroll.profitCycle.set",
      entityType: "Setting",
      entityId: "hr.profitCycle",
      before: { versions: before },
      after: { versions: res.data },
    },
    req,
  );
  return ok({ versions: res.data });
}
