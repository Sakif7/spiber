import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { signatureImageSchema } from "@/lib/schemas/hr";
import {
  clearEmployeeSignature,
  employeeSignatureInfo,
  pngFromDataUrl,
  setEmployeeSignature,
} from "@/lib/services/hr/employee-signature.service";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const status = (code: string) =>
  code === "not_found"
    ? 404
    : code === "vault_not_configured"
      ? 503
      : code === "too_large"
        ? 413
        : 400;

/** Whether this employee has a signature on file (the card reads this). */
export async function GET(_req: Request, { params }: Params) {
  const g = await guardSales("hr-read");
  if (!g.ok) return g.res;
  const { id } = await params;
  const info = await employeeSignatureInfo(id);
  return ok({ signature: info });
}

/** Set or replace the employee's signature — a super admin, on their page. */
export async function POST(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, signatureImageSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const png = pngFromDataUrl(parsed.data.image);
  if (!png) return fail({ code: "bad_image" }, 400);
  const res = await setEmployeeSignature(id, png, g.actor, {
    source: parsed.data.source,
    req,
  });
  if (!res.ok) return fail({ code: res.code }, status(res.code));
  return ok({ signature: res.data });
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const res = await clearEmployeeSignature(id, g.actor, { req });
  if (!res.ok) return fail({ code: res.code }, status(res.code));
  return ok({ removed: true });
}
