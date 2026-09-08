import { connectToDatabase } from "@/lib/db/connect";
import { AuditLog } from "@/lib/models/auditLog";
import { clientIp } from "@/lib/auth/rate-limit";

/**
 * Audit a gated-document view, fail-closed and without flooding the log.
 *
 * WHY THIS EXISTS
 * The gated media routes used to audit only the "initial view" — a request with
 * no `Range` header, or one starting at byte 0:
 *
 *     const isInitialView = !range || /^bytes=0-/.test(range);
 *     if (isInitialView) { await writeAudit(...) }
 *
 * That skipped the audit entirely for `Range: bytes=1-`, which returns
 * essentially the whole document. So anyone able to reach the route could read
 * a medical report, a résumé, a KYC document or a vault file with NO audit row
 * and, worse, without the fail-closed check that is supposed to deny access
 * when the audit cannot be written.
 *
 * The fix is to audit EVERY request and dedupe on time instead of on the shape
 * of the Range header: the first read by an actor is always recorded, and a PDF
 * viewer's follow-up byte-range requests collapse into that one row for the next
 * few minutes. A second deliberate view after the window is a new row, which is
 * what an access log should show.
 *
 * Callers MUST let this throw: a failure to record the access is a failure to
 * serve it (respond 503), which is what "fail-closed" means here.
 */

/** How long a recorded view suppresses further rows for the same actor+document. */
export const VIEW_AUDIT_WINDOW_MS = 5 * 60 * 1000;

export type DocumentViewAudit = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Non-sensitive context (index, filename, title) — never the storage key. */
  after?: Record<string, unknown>;
  /** The request, so the row records the caller's IP. */
  req?: Request;
};

/**
 * Records the view unless the same actor already has one for this document
 * within `VIEW_AUDIT_WINDOW_MS`. Throws if the log cannot be read or written.
 */
export async function auditDocumentView(
  entry: DocumentViewAudit,
): Promise<void> {
  await connectToDatabase();

  const since = new Date(Date.now() - VIEW_AUDIT_WINDOW_MS);
  // Covered by the { entityType, entityId, createdAt } index.
  const recent = await AuditLog.exists({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    createdAt: { $gte: since },
  });
  if (recent) return;

  await AuditLog.create({
    actorId: entry.actorId,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    after: entry.after,
    ip: entry.req ? clientIp(entry.req) : undefined,
  });
}
