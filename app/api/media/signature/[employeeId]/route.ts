import { requireStaff } from "@/lib/auth/guard";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { findEmployeeByUserId } from "@/lib/repositories/employees.repo";
import { loadEmployeeSignature } from "@/lib/services/hr/employee-signature.service";

export const dynamic = "force-dynamic";

/**
 * An employee's signature image, decrypted in memory for the screen: the
 * super admin (the employee's page, a document being written) or the person
 * themself (their portal). Never cached, never public. Paper never comes
 * through here — the printer reads the bytes directly.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ employeeId: string }> },
) {
  const staff = await requireStaff();
  if (!staff) return new Response(null, { status: 401 });
  const { employeeId } = await params;
  if (!isSuperAdmin(staff)) {
    const mine = await findEmployeeByUserId(staff.sub).catch(() => null);
    if (!mine || String(mine._id) !== employeeId) {
      return new Response(null, { status: 403 });
    }
  }
  const sig = await loadEmployeeSignature(employeeId);
  if (!sig) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(sig.data), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(sig.data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
