import { ok, fail } from "@/lib/http/respond";
import { visitUpdateSchema } from "@/lib/schemas/expense";
import { updateVisit, deleteVisit } from "@/lib/services/hr/visit.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardPeople, peopleStatus } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const g = await guardPeople("visit-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = visitUpdateSchema.safeParse(
    await req.json().catch(() => null),
  );
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }

  const res = await updateVisit(id, parsed.data);
  if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "visit.update",
      entityType: "Visit",
      entityId: id,
      after: parsed.data,
    },
    req,
  );
  return ok({ id });
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardPeople("visit-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const res = await deleteVisit(id);
  if (!res.ok) return fail({ code: res.code }, peopleStatus(res.code));

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "visit.delete",
      entityType: "Visit",
      entityId: id,
    },
    req,
  );
  return ok({ id });
}
