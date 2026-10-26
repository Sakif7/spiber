import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { payScheduleUpdateSchema } from "@/lib/schemas/hr";
import {
  archiveSchedule,
  resolveSchedule,
  updateSchedule,
} from "@/lib/services/hr/pay-schedule.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../sales/_guard";
import { scheduleStatus } from "../_status";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ ref: string }> };

/**
 * Rename, re-time or re-staff a schedule. A new cycle applies from a day and
 * is refused inside a period anyone on it has already been paid for.
 */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { ref } = await params;

  const parsed = await parseJson(req, payScheduleUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const before = await resolveSchedule(ref);
  const res = await updateSchedule(ref, parsed.data, g.actor);
  if (!res.ok) return fail({ code: res.code }, scheduleStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "paySchedule.update",
      entityType: "PaySchedule",
      entityId: res.data.id,
      before: before
        ? {
            name: before.name,
            versions: before.versions,
            paydayOffsetDays: before.paydayOffsetDays,
            isDefault: before.isDefault,
          }
        : undefined,
      after: { ...parsed.data, versions: res.data.versions },
    },
    req,
  );
  return ok(res.data);
}

/** Retire a schedule nobody is on. */
export async function DELETE(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { ref } = await params;

  const res = await archiveSchedule(ref, g.actor);
  if (!res.ok) return fail({ code: res.code }, scheduleStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "paySchedule.archive",
      entityType: "PaySchedule",
      entityId: ref,
    },
    req,
  );
  return ok({ id: ref });
}
