import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { employeeUpdateSchema } from "@/lib/schemas/hr";
import {
  updateEmployee,
  softDeleteEmployee,
} from "@/lib/services/hr/employee.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, employeeUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await updateEmployee(id, parsed.data);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "not_found" ? 404 : 409);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.update",
      entityType: "Employee",
      entityId: id,
      after: parsed.data,
    },
    req,
  );
  return ok({ id });
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;
  const { id } = await params;

  const removed = await softDeleteEmployee(id).catch(() => false);
  if (!removed) return fail({ code: "not_found" }, 404);

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.delete",
      entityType: "Employee",
      entityId: id,
    },
    req,
  );
  return ok({ id });
}
