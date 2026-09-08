import { timingSafeEqual } from "node:crypto";
import { ok, fail } from "@/lib/http/respond";
import { requireAdmin } from "@/lib/auth/guard";
import { sendLowStockDigest } from "@/lib/services/inventory-alerts.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/**
 * Daily low-stock digest. Call once a day from a scheduler with
 * `Authorization: Bearer <CRON_SECRET>` (or `x-cron-secret`); a signed-in
 * admin may also trigger it from the inventory hub ("Send digest now", which
 * passes `?force=1` so an all-clear mail still goes out).
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

  const force = new URL(req.url).searchParams.get("force") === "1";
  const result = await sendLowStockDigest({ force });
  if (admin) {
    await writeAudit({
      actorId: admin.sub,
      action: "inventory.digest.send",
      entityType: "Inventory",
      after: result,
    });
  }
  return ok(result);
}

/**
 * GET is for schedulers only, and must present the shared secret.
 *
 * The job used to accept a GET authorised by an admin's session cookie, which
 * meant any page the admin visited could trigger it with an <img> tag — a
 * cross-site request the cookie's SameSite=Lax does not stop on a top-level
 * navigation. Admin-initiated runs now go through POST, which the proxy's
 * same-origin check covers.
 */
export async function GET(req: Request) {
  if (!secretOk(req)) return fail({ code: "forbidden" }, 403);
  return run(req);
}

export async function POST(req: Request) {
  return run(req);
}
