import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { sharePoolSchema } from "@/lib/schemas/hr";
import { getSharePool, setSharePool } from "@/lib/services/hr/employee.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/** The share pool every director's holding is a fraction of. */
export async function GET() {
  const g = await guardSales("hr-read");
  if (!g.ok) return g.res;
  return ok(await getSharePool());
}

/**
 * Set the pool. Refused when it would shrink below what directors already
 * hold — their fractions would then add up to more than one.
 */
export async function PUT(req: Request) {
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, sharePoolSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const before = await getSharePool();
  const res = await setSharePool(parsed.data);
  if (!res.ok) return fail({ code: res.code }, 409);

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "sharePool.set",
      entityType: "Setting",
      entityId: "hr.sharePool",
      before,
      after: res.data,
    },
    req,
  );
  return ok(res.data);
}
