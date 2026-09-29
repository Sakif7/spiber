import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { emailSignatureSchema } from "@/lib/schemas/hr";
import {
  clearEmailSignature,
  setEmailSignature,
} from "@/lib/services/hr/email-signature.service";
import { guardSales } from "../../../../sales/_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const status = (code: string) => (code === "not_found" ? 404 : 400);

/** Set or replace the employee's email signature — a super admin, on their page. */
export async function PUT(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, emailSignatureSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await setEmailSignature(id, parsed.data, g.actor, { req });
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "empty"
            ? "Write the signature first — it has no text."
            : res.code === "too_long"
              ? "That is too long for a signature."
              : undefined,
      },
      status(res.code),
    );
  }
  return ok({ signature: res.data });
}

export async function DELETE(req: Request, { params }: Params) {
  const g = await guardSales("hr-write", 30);
  if (!g.ok) return g.res;
  const { id } = await params;
  const res = await clearEmailSignature(id, g.actor, { req });
  if (!res.ok) return fail({ code: res.code }, status(res.code));
  return ok({ removed: true });
}
