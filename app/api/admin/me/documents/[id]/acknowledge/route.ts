import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { clientIp } from "@/lib/auth/rate-limit";
import { acknowledgeDocumentSchema } from "@/lib/schemas/authored-document";
import { acknowledgeDocument } from "@/lib/services/documents/document-signing.service";
import { guardMe } from "../../../_guard";

export const dynamic = "force-dynamic";

/**
 * The recipient's act. Always the signed-in employee's own row — the body
 * never says who is acknowledging.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardMe("document-acknowledge", 20);
  if (!g.ok) return g.res;
  const { id } = await params;
  const parsed = await parseJson(req, acknowledgeDocumentSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const res = await acknowledgeDocument(
    g.session,
    id,
    { typedName: parsed.data.typedName, ip: clientIp(req) },
    req,
  );
  if (!res.ok) {
    const status =
      res.code === "not_found"
        ? 404
        : res.code === "not_pending"
          ? 409
          : res.code === "print_failed" || res.code === "vault_failed"
            ? 503
            : 400;
    return fail({ code: res.code, message: res.detail }, status);
  }
  return ok(res.data);
}
