import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { signatureImageSchema } from "@/lib/schemas/hr";
import {
  clearEmployeeSignature,
  employeeSignatureInfo,
  pngFromDataUrl,
  setEmployeeSignature,
} from "@/lib/services/hr/employee-signature.service";
import { guardMe } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * The employee's own signature, from the portal. The record is always the
 * signed-in person's — nothing in the body chooses whose signature this is.
 */
export async function GET() {
  const g = await guardMe("signature-read");
  if (!g.ok) return g.res;
  return ok({
    signature: await employeeSignatureInfo(String(g.session.employee._id)),
  });
}

export async function POST(req: Request) {
  const g = await guardMe("signature-write", 20);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, signatureImageSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const png = pngFromDataUrl(parsed.data.image);
  if (!png) return fail({ code: "bad_image" }, 400);
  const res = await setEmployeeSignature(
    String(g.session.employee._id),
    png,
    g.actor,
    { source: parsed.data.source, self: true, req },
  );
  if (!res.ok) {
    return fail(
      { code: res.code },
      res.code === "vault_not_configured"
        ? 503
        : res.code === "too_large"
          ? 413
          : 400,
    );
  }
  return ok({ signature: res.data });
}

export async function DELETE(req: Request) {
  const g = await guardMe("signature-write", 20);
  if (!g.ok) return g.res;
  const res = await clearEmployeeSignature(
    String(g.session.employee._id),
    g.actor,
    {
      self: true,
      req,
    },
  );
  if (!res.ok) return fail({ code: res.code }, 404);
  return ok({ removed: true });
}
