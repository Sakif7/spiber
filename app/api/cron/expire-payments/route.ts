import { timingSafeEqual } from "node:crypto";
import { ok, fail } from "@/lib/http/respond";
import { requireAdmin } from "@/lib/auth/guard";
import { sweepPayments } from "@/lib/services/payment.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/**
 * The payment sweeper (Coolify scheduled task, every 5 minutes, since
 * 2026-10-28 — keep this path, the task points at it).
 *
 * Asks the gateway about every open try that is due, settles any that were
 * paid, and releases the stock of orders whose hold ran out unpaid. Without
 * it a customer who paid and closed the tab waits on PayStation's
 * notification alone, and every abandoned checkout holds its stock forever.
 *
 * `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`). An admin can
 * also run it by POST.
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

  const result = await sweepPayments();
  if (admin && (result.expired > 0 || result.settled > 0)) {
    await writeAudit(
      {
        actorId: admin.sub,
        action: "payment.sweep",
        entityType: "Order",
        after: result,
      },
      req,
    );
  }
  return ok(result);
}

/**
 * GET is for schedulers only, and must present the shared secret.
 *
 * The job used to accept a GET authorised by an admin's session cookie, which
 * meant any page the admin visited could trigger it with an <img> tag — a
 * cross-site request the cookie's SameSite=Lax does not stop on a top-level
 * navigation. Admin-initiated runs go through POST, which the proxy's
 * same-origin check covers.
 */
export async function GET(req: Request) {
  if (!secretOk(req)) return fail({ code: "forbidden" }, 403);
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
