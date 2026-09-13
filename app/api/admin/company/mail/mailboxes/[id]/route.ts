import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { writeAudit } from "@/lib/repositories/audit.repo";
import {
  removeSharedMailbox,
  setAssignedUsers,
} from "@/lib/services/mail-admin.service";
import { guardSales } from "../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  assignedUserIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).max(200),
});

/** Who may open a shared mailbox. */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guardSales("mail-admin-write", 60);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, patchSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await setAssignedUsers(id, parsed.data.assignedUserIds, g.actor);
  if (!res.ok) return fail({ code: res.code }, 404);
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "mailbox.shared.assign",
      entityType: "Mailbox",
      entityId: id,
      after: { assignedUserIds: (res.data.assignedUserIds ?? []).map(String) },
    },
    req,
  );
  return ok({
    id,
    assignedUserIds: (res.data.assignedUserIds ?? []).map(String),
  });
}

/** Stop opening a shared mailbox here; the server account is untouched. */
export async function DELETE(req: Request, { params }: Params) {
  const g = await guardSales("mail-admin-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const removed = await removeSharedMailbox(id, g.actor);
  if (!removed) return fail({ code: "not_found" }, 404);
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "mailbox.shared.remove",
      entityType: "Mailbox",
      entityId: id,
    },
    req,
  );
  return ok({ id });
}
