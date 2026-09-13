import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { visitCreateSchema } from "@/lib/schemas/expense";
import { createVisit } from "@/lib/services/hr/visit.service";
import { myLead } from "@/lib/services/me.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardMe } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * Record a visit from the portal. The signed-in employee is always among the
 * attendees, and a lead may only be attached if it is one of theirs.
 */
export async function POST(req: Request) {
  const g = await guardMe("visit-create", 30);
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, visitCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const me = String(g.session.employee._id);
  const attendees = [...new Set([me, ...parsed.data.attendees])];
  if (parsed.data.leadId && !(await myLead(g.session, parsed.data.leadId))) {
    return fail({ code: "lead_not_yours" }, 403);
  }

  const visit = await createVisit({ ...parsed.data, attendees }, g.actor);
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "visit.create",
      entityType: "Visit",
      entityId: String(visit._id),
      after: { ref: visit.ref, purpose: visit.purpose, via: "portal" },
    },
    req,
  );
  return ok({ id: String(visit._id), ref: visit.ref });
}
