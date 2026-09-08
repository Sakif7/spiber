import { ok, fail } from "@/lib/http/respond";
import { visitCreateSchema } from "@/lib/schemas/expense";
import { createVisit } from "@/lib/services/hr/visit.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardPeople } from "../_guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const g = await guardPeople("visit-write");
  if (!g.ok) return g.res;

  const parsed = visitCreateSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }

  const visit = await createVisit(parsed.data, g.actor);
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "visit.create",
      entityType: "Visit",
      entityId: String(visit._id),
      after: { ref: visit.ref, purpose: visit.purpose },
    },
    req,
  );
  return ok({ id: String(visit._id), ref: visit.ref }, { status: 201 });
}
