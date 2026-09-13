import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { employeeCreateWithAccessSchema } from "@/lib/schemas/hr";
import { createEmployeeWithAccess } from "@/lib/services/hr/employee-access.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * Create an employee — and, in the same request, their mailbox, portal login
 * and invite. A taken address fails before anything is written; a mail-server
 * failure afterwards still returns 200 with `access.ok: false`, because the
 * person exists and the page offers a retry.
 */
export async function POST(req: Request) {
  // Same guard as Sales: pay and percentages are super-admin material.
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, employeeCreateWithAccessSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await createEmployeeWithAccess(parsed.data, g.actor);
  if (!res.ok) {
    const status =
      res.code === "duplicate_user" ||
      res.code === "address_taken" ||
      res.code === "login_taken"
        ? 409
        : res.code === "vault_not_configured" ||
            res.code === "provisioner_not_configured"
          ? 503
          : 400;
    return fail({ code: res.code, message: res.detail }, status);
  }

  const { employee, access } = res.data;
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.create",
      entityType: "Employee",
      entityId: String(employee._id),
      after: {
        name: employee.name,
        designation: employee.designation,
        businessEmail: employee.businessEmail,
        access: access.ok
          ? {
              mailbox: access.data.mailbox.status,
              invite: access.data.inviteEmailed ? "emailed" : "link",
            }
          : { failed: access.code },
      },
    },
    req,
  );
  return ok({
    id: String(employee._id),
    code: employee.code,
    access: access.ok
      ? {
          ok: true as const,
          mailboxStatus: access.data.mailbox.status,
          inviteLink: access.data.inviteLink,
          inviteEmailed: access.data.inviteEmailed,
          linkedExistingLogin: access.data.linkedExistingLogin,
        }
      : { ok: false as const, code: access.code, detail: access.detail },
  });
}
