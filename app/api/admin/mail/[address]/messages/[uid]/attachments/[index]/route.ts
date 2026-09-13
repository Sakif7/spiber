import { fail } from "@/lib/http/respond";
import { getAttachment } from "@/lib/services/mail.service";
import { guardMailbox, storeError } from "../../../../../_guard";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ address: string; uid: string; index: string }>;
};

const INLINE_OK =
  /^(image\/(png|jpe?g|gif|webp|bmp)|application\/pdf|text\/plain)$/i;

/**
 * Streams one attachment. `inline=1` renders images/PDFs in the page (used
 * for `cid:` images); everything else is always a download, and the content
 * type is never one a browser would execute.
 */
export async function GET(req: Request, { params }: Params) {
  const { address, uid, index } = await params;
  const g = await guardMailbox(address, "attachment", 120);
  if (!g.ok) return g.res;
  const url = new URL(req.url);
  const folder = url.searchParams.get("folder") ?? "";
  const n = Number(uid);
  const i = Number(index);
  if (
    !folder ||
    !Number.isInteger(n) ||
    n <= 0 ||
    !Number.isInteger(i) ||
    i < 0
  ) {
    return fail({ code: "invalid_input" }, 400);
  }
  try {
    const att = await getAttachment(g.access, folder, n, i);
    if (!att) return fail({ code: "not_found" }, 404);
    const type = att.contentType.split(";")[0].trim().toLowerCase();
    const inline =
      url.searchParams.get("inline") === "1" && INLINE_OK.test(type);
    const safeName = att.filename
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .slice(0, 120);
    return new Response(new Uint8Array(att.content), {
      headers: {
        "Content-Type": inline ? type : "application/octet-stream",
        "Content-Length": String(att.content.length),
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${safeName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return storeError(e);
  }
}
