import { timingSafeEqual } from "node:crypto";
import { ok, fail } from "@/lib/http/respond";
import { requireAdmin } from "@/lib/auth/guard";
import { expireStalePayments } from "@/lib/services/payment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/**
 * Release the stock held by online payments that never completed.
 *
 * Run this every few minutes from a scheduler with
 * `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`). Without it,
 * every abandoned checkout keeps its reserved stock forever, so this is not
 * optional once online payment is switched on. An admin can also trigger it.
 */
function secretOk(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const given = bearer || (req.headers.get("x-cron-secret") ?? "").trim();
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function run(req: Request) {
  const viaSecret = secretOk(req);
  const admin = viaSecret ? null : await requireAdmin();
  if (!viaSecret && !admin) return fail({ code: "forbidden" }, 403);

  const result = await expireStalePayments();
  if (admin && result.expired > 0) {
    await writeAudit({
      actorId: admin.sub,
      action: "payment.expire_stale",
      entityType: "Order",
      after: result,
    });
  }
  return ok(result);
}

export async function GET(req: Request) {
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
