import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { employeeCreateSchema } from "@/lib/schemas/hr";
import { createEmployee } from "@/lib/services/hr/employee.service";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Same guard as Sales: pay and percentages are super-admin material.
  const g = await guardSales("hr-write");
  if (!g.ok) return g.res;

  const parsed = await parseJson(req, employeeCreateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const res = await createEmployee(parsed.data, g.actor);
  if (!res.ok) {
    return fail({ code: res.code }, res.code === "duplicate_user" ? 409 : 400);
  }

  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "employee.create",
      entityType: "Employee",
      entityId: String(res.data._id),
      after: { name: res.data.name, designation: res.data.designation },
    },
    req,
  );
  return ok({ id: String(res.data._id), code: res.data.code });
}
