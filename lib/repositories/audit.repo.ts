import { connectToDatabase } from "@/lib/db/connect";
import { AuditLog, type IAuditLog } from "@/lib/models/auditLog";
import { clientIp } from "@/lib/auth/rate-limit";

/**
 * Record an administrative action.
 *
 * Pass the `Request` to have the caller's IP recorded: the model has always had
 * an `ip` field but nothing populated it, so every row read "someone, somewhere".
 * It stays optional because plenty of call sites (services, cron jobs) have no
 * request to hand.
 */
export async function writeAudit(entry: Partial<IAuditLog>, req?: Request) {
  await connectToDatabase();
  return AuditLog.create(
    req && entry.ip === undefined ? { ...entry, ip: clientIp(req) } : entry,
  );
}
