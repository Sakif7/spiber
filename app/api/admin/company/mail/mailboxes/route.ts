import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { MAIL_LOCAL_PART } from "@/lib/mail/address";
import {
  createSharedMailbox,
  listMailboxes,
  listStaffUsers,
} from "@/lib/services/mail-admin.service";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/** Super-admin only, like the rest of Company. */
export async function GET() {
  const g = await guardSales("mail-admin", 120);
  if (!g.ok) return g.res;
  const [mailboxes, staff] = await Promise.all([
    listMailboxes(),
    listStaffUsers(),
  ]);
  return ok({
    mailboxes: mailboxes.map((m) => ({
      id: String(m._id),
      address: m.address,
      kind: m.kind,
      status: m.status,
      ownerUserId: m.ownerUserId ? String(m.ownerUserId) : null,
      assignedUserIds: (m.assignedUserIds ?? []).map(String),
    })),
    staff,
  });
}

const createSchema = z.object({
  local: z.string().trim().toLowerCase().regex(MAIL_LOCAL_PART),
});

export async function POST(req: Request) {
  const g = await guardSales("mail-admin-write", 30);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, createSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await createSharedMailbox(parsed.data.local, g.actor);
  if (!res.ok) {
    const status =
      res.code === "exists"
        ? 409
        : res.code === "provisioner_not_configured"
          ? 503
          : res.code === "not_on_server"
            ? 404
            : 400;
    return fail({ code: res.code, message: res.detail }, status);
  }
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "mailbox.shared.create",
      entityType: "Mailbox",
      entityId: String(res.data._id),
      after: { address: res.data.address },
    },
    req,
  );
  return ok({ id: String(res.data._id), address: res.data.address });
}
