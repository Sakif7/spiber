import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { MAIL_LOCAL_PART } from "@/lib/mail/address";
import {
  assignBusinessEmail,
  provisionEmployeeAccess,
  resetMailboxPassword,
  revealMailboxPassword,
  sendInvite,
  setEmployeeLoginDisabled,
  setMailboxDisabled,
  type AccessError,
  type AccessResult,
} from "@/lib/services/hr/employee-access.service";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.enum([
      "provision",
      "resend_invite",
      "disable_login",
      "enable_login",
      "reveal_mailbox_password",
      "reset_mailbox_password",
      "disable_mailbox",
      "enable_mailbox",
    ]),
  }),
  // A record from before unified mail gets its address here.
  z.object({
    action: z.literal("assign_address"),
    local: z
      .string()
      .trim()
      .toLowerCase()
      .regex(MAIL_LOCAL_PART, "letters, digits, dots and dashes only"),
  }),
]);
type Body = z.infer<typeof bodySchema>;

const STATUS: Record<AccessError, number> = {
  not_found: 404,
  invalid_address: 400,
  address_taken: 409,
  login_taken: 409,
  vault_not_configured: 503,
  provisioner_not_configured: 503,
  provision_failed: 502,
  no_business_email: 400,
  no_login: 400,
};

/**
 * Everything the "Login & mailbox" card can do. Every action is audited;
 * revealing a password is the sensitive one and says so in the log. The
 * mailbox row itself (ciphertext) is never echoed back — each action returns
 * only what its button needs.
 */
export async function POST(req: Request, { params }: Params) {
  const g = await guardSales("hr-access", 60);
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, bodySchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { action } = parsed.data;

  const res = await run(parsed.data, id, g.actor);

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: `employee.access.${action}`,
      entityType: "Employee",
      entityId: id,
      after: res.ok ? { ok: true } : { ok: false, code: res.code },
    },
    req,
  );

  if (!res.ok) {
    return fail({ code: res.code, message: res.detail }, STATUS[res.code]);
  }
  return ok(res.data);
}

const outcome = (r: Awaited<ReturnType<typeof provisionEmployeeAccess>>) =>
  r.ok
    ? {
        ok: true as const,
        data: {
          mailboxStatus: r.data.mailbox.status,
          inviteLink: r.data.inviteLink,
          inviteEmailed: r.data.inviteEmailed,
          linkedExistingLogin: r.data.linkedExistingLogin,
        },
      }
    : r;

async function run(
  body: Body,
  id: string,
  actor: { sub: string; email: string },
): Promise<AccessResult<Record<string, unknown>>> {
  switch (body.action) {
    case "assign_address":
      return outcome(await assignBusinessEmail(id, body.local, actor));
    case "provision":
      return outcome(await provisionEmployeeAccess(id, actor));
    case "resend_invite":
      return sendInvite(id, actor);
    case "disable_login":
      return setEmployeeLoginDisabled(id, true, actor);
    case "enable_login":
      return setEmployeeLoginDisabled(id, false, actor);
    case "reveal_mailbox_password":
      return revealMailboxPassword(id, actor);
    case "reset_mailbox_password":
      return resetMailboxPassword(id, actor);
    case "disable_mailbox":
      return setMailboxDisabled(id, true, actor);
    case "enable_mailbox":
      return setMailboxDisabled(id, false, actor);
  }
}
