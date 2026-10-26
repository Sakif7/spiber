import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { payScheduleCreateSchema } from "@/lib/schemas/hr";
import {
  createSchedule,
  listSchedules,
} from "@/lib/services/hr/pay-schedule.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../sales/_guard";
import { scheduleStatus } from "./_status";

export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guardSales("hr-read");
  if (!g.ok) return g.res;
  return ok(await listSchedules());
}

/** A new pay schedule, optionally with people moved onto it. */
export async function POST(req: Request) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, payScheduleCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await createSchedule(parsed.data, g.actor);
  if (!res.ok) return fail({ code: res.code }, scheduleStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "paySchedule.create",
      entityType: "PaySchedule",
      entityId: res.data.id,
      after: {
        name: res.data.name,
        versions: res.data.versions,
        paydayOffsetDays: res.data.paydayOffsetDays,
        isDefault: res.data.isDefault,
        employeeIds: parsed.data.employeeIds ?? [],
      },
    },
    req,
  );
  return ok(res.data);
}
