import { requireAdmin } from "@/lib/auth/guard";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { eventSchema } from "@/lib/schemas/events";
import { saveEvent } from "@/lib/services/events.service";
import { softDeleteEvent } from "@/lib/repositories/events.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

/** Update an event. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  const parsed = await parseJson(req, eventSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const result = await saveEvent(parsed.data, id);
  if (!result.ok) {
    return fail({ code: result.code }, result.code === "not_found" ? 404 : 409);
  }

  await writeAudit({
    actorId: admin.sub,
    action: "event.update",
    entityType: "Event",
    entityId: id,
    after: { slug: result.slug, status: parsed.data.status },
  });

  return ok({ id: result.id, slug: result.slug });
}

/** Soft-delete an event. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;

  await softDeleteEvent(id);
  await writeAudit({
    actorId: admin.sub,
    action: "event.delete",
    entityType: "Event",
    entityId: id,
  });

  return ok({ id });
}
