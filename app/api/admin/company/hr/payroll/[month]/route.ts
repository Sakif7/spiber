import { ok, fail } from "@/lib/http/respond";
import {
  getRun,
  approveRun,
  reopenRun,
} from "@/lib/services/hr/payroll.service";
import { payrollReopenSchema } from "@/lib/schemas/hr";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ month: string }> };

const status = (code: string) =>
  code === "not_found" ? 404 : code === "bad_month" ? 400 : 409;

/** Recompute and return the month. */
export async function GET(_req: Request, { params }: Params) {
  const g = await guardSales("hr-read", 240);
  if (!g.ok) return g.res;
  const { month } = await params;

  const res = await getRun(month, g.actor);
  if (!res.ok) return fail({ code: res.code }, status(res.code));
  return ok(res.data);
}

/** Approve the month, or reopen an approved one. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 60);
  if (!g.ok) return g.res;
  const { month } = await params;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    reason?: string;
  } | null;

  if (body?.action === "approve") {
    const res = await approveRun(month, g.actor);
    if (!res.ok) return fail({ code: res.code }, status(res.code));
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "payroll.approve",
        entityType: "PayrollRun",
        entityId: month,
        after: {
          totalMinor: res.data.totalMinor,
          lines: res.data.lines.length,
        },
      },
      req,
    );
    return ok({ month, status: res.data.status });
  }

  if (body?.action === "reopen") {
    const parsed = payrollReopenSchema.safeParse(body);
    if (!parsed.success) {
      return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
    }
    const res = await reopenRun(month, parsed.data.reason, g.actor);
    if (!res.ok) return fail({ code: res.code }, status(res.code));
    await writeAudit(
      {
        actorId: g.actor.sub,
        action: "payroll.reopen",
        entityType: "PayrollRun",
        entityId: month,
        after: { reason: parsed.data.reason },
      },
      req,
    );
    return ok({ month, status: res.data.status });
  }

  return fail({ code: "invalid_input" }, 400);
}
