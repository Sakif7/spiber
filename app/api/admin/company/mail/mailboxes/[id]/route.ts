import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { writeAudit } from "@/lib/repositories/audit.repo";
import {
  removeSharedMailbox,
  resetSharedMailboxPassword,
  revealSharedMailboxPassword,
  setAssignedUsers,
} from "@/lib/services/mail-admin.service";
import { guardSales } from "../../../sales/_guard";
import { mailAdminStatus } from "../../_status";

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

const passwordSchema = z.object({
  action: z.enum(["reveal_password", "reset_password"]),
});

/**
 * The mailbox's own password, for a phone: reveal the stored one or set a
 * new one on the server. Both are audited with the actor.
 */
export async function POST(req: Request, { params }: Params) {
  const g = await guardSales("mail-admin-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, passwordSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res =
    parsed.data.action === "reveal_password"
      ? await revealSharedMailboxPassword(id, g.actor)
      : await resetSharedMailboxPassword(id, g.actor);
  if (!res.ok) {
    return fail(
      { code: res.code, message: res.detail },
      mailAdminStatus(res.code),
    );
  }
  await writeAudit(
    {
      actorId: g.actor.sub,
      action:
        parsed.data.action === "reveal_password"
          ? "mailbox.shared.password_reveal"
          : "mailbox.shared.password_reset",
      entityType: "Mailbox",
      entityId: id,
      after: { address: res.data.address },
    },
    req,
  );
  return ok(res.data);
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
