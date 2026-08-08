import { getQuotationByIdLean } from "@/lib/repositories/quotations.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { requireAdmin } from "@/lib/auth/guard";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Gated download of a quotation's attached PDF. Business quotes are private:
 * only the requester (owner) or an admin may fetch them — never a public URL.
 * Streams from storage (R2/local private root) with Range support; also
 * recovers the key from legacy fileKey values that stored a public URL.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let quotation;
  try {
    quotation = await getQuotationByIdLean(id);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!quotation?.quote?.fileKey)
    return new Response("Not found", { status: 404 });

  const isOwner =
    quotation.requesterId != null && String(quotation.requesterId) === user.sub;
  if (!isOwner) {
    const admin = await requireAdmin();
    if (!admin) return new Response("Forbidden", { status: 403 });
  }

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage().getObject({
    key: toStorageKey(String(quotation.quote.fileKey)),
    range,
  });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType || "application/pdf");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set(
    "Content-Disposition",
    `inline; filename="quotation-${quotation.quotationNumber}.pdf"`,
  );
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}

/** Recover the storage key from a raw key or a legacy public-URL fileKey. */
function toStorageKey(fileKey: string): string {
  let path = fileKey;
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      /* keep as-is */
    }
  }
  return path
    .replace(/^\/?api\/media\/asset\//, "")
    .replace(/^\/?uploads\//, "")
    .replace(/^\/+/, "");
}
