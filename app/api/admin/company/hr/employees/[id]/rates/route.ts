import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { shareholdingSchema } from "@/lib/schemas/hr";
import { addHolding } from "@/lib/services/hr/employee.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * Record a new shareholding, from a given month.
 *
 * Appends rather than edits, so a payroll month already produced keeps the
 * holding that was actually in force at the time. Refused when it would take
 * more shares than the pool has left.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, shareholdingSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await addHolding(id, parsed.data, g.actor);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "not_found" ? 404 : 409);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.holding.add",
      entityType: "Employee",
      entityId: id,
      after: {
        shares: parsed.data.shares,
        effectiveFrom: parsed.data.effectiveFrom,
      },
    },
    req,
  );
  return ok({ id, shares: parsed.data.shares });
}
