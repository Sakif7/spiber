import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { bulkAdjustSchema } from "@/lib/schemas/inventory";
import { adminBulkAdjust } from "@/lib/services/inventory.service";
import { writeAudit } from "@/lib/repositories/audit.repo";

/** Many deltas at once (bulk receive from the hub, or a confirmed CSV import). */
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const parsed = await parseJson(req, bulkAdjustSchema);
  if (!parsed.success)
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  const result = await adminBulkAdjust({
    ...parsed.data,
    createdBy: admin.sub,
  });
  await writeAudit({
    actorId: admin.sub,
    action: `inventory.${parsed.data.source}`,
    entityType: "Inventory",
    after: {
      type: parsed.data.type,
      reason: parsed.data.reason,
      lines: parsed.data.lines.length,
      applied: result.applied,
      failed: result.failed,
    },
  });
  return ok(result);
}
