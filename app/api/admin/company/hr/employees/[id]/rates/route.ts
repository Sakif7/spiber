import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { shareRateSchema } from "@/lib/schemas/hr";
import { addRate } from "@/lib/services/hr/employee.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * Set a new revenue share, from a given month.
 *
 * Appends rather than edits, so a payroll month already produced keeps the rate
 * that was actually agreed at the time.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, shareRateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await addRate(id, parsed.data, g.actor);
  if (!res.ok) return fail({ code: res.code }, 404);

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.rate.add",
      entityType: "Employee",
      entityId: id,
      after: {
        rateBp: parsed.data.rateBp,
        effectiveFrom: parsed.data.effectiveFrom,
      },
    },
    req,
  );
  return ok({ id, rateBp: parsed.data.rateBp });
}
