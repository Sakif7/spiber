import { ok, fail } from "@/lib/http/respond";
import { payoutVoidSchema } from "@/lib/schemas/hr";
import { voidPayout } from "@/lib/services/hr/payout.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Void a payout recorded by mistake — everything it paid becomes due again. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardSales("hr-pay", 30);
  if (!g.ok) return g.res;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
  } | null;
  if (body?.action !== "void") return fail({ code: "invalid_input" }, 400);

  const parsed = payoutVoidSchema.safeParse(body);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }

  const res = await voidPayout(id, parsed.data.reason, g.actor);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "not_found" ? 404 : 409);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "payroll.payout.void",
      entityType: "PayrollPayout",
      entityId: id,
      after: {
        ref: res.data.ref,
        totalMinor: res.data.totalMinor,
        reason: parsed.data.reason,
      },
    },
    req,
  );
  return ok({ id, status: res.data.status });
}
