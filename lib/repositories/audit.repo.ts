import { connectToDatabase } from "@/lib/db/connect";
import { AuditLog, type IAuditLog } from "@/lib/models/auditLog";

export async function writeAudit(entry: Partial<IAuditLog>) {
  await connectToDatabase();
  return AuditLog.create(entry);
}
