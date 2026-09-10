import { renderVersion } from "@/lib/services/sales-document.service";
import { auditDocumentView } from "@/lib/audit/document-view";
import { logger } from "@/lib/log";
import { guardSales } from "../../../../../_guard";

export const dynamic = "force-dynamic";

/**
 * Serve one stored version of a proposal, invoice or delivery challan as a PDF.
 *
 * Re-rendered from the version's own snapshot, so an old document reproduces
 * exactly as it was sent even after the order has been amended. Access is
 * audited fail-closed: these carry client pricing.
 */
export async function GET(
  req: Request,
  {
    params,
  }: { params: Promise<{ id: string; kind: string; version: string }> },
) {
  const g = await guardSales("sales-doc", 60);
  if (!g.ok) return g.res;

  const { id, kind, version } = await params;
  if (kind !== "proposal" && kind !== "invoice" && kind !== "challan") {
    return new Response("Not found", { status: 404 });
  }
  const v = Number.parseInt(version, 10);
  if (!Number.isInteger(v) || v < 1) {
    return new Response("Not found", { status: 404 });
  }

  try {
    await auditDocumentView({
      actorId: g.actor.sub,
      action: `salesOrder.${kind}.view`,
      entityType: "SalesOrder",
      entityId: id,
      after: { kind, version: v },
      req,
    });
  } catch (e) {
    logger.warn("sales document audit failed; denying access", e);
    return new Response("Audit unavailable", { status: 503 });
  }

  const res = await renderVersion(id, kind, v);
  if (!res.ok) return new Response("Not found", { status: 404 });

  const download = new URL(req.url).searchParams.get("download");
  return new Response(new Uint8Array(res.data.pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${res.data.filename.replace(/[^\w.\- ]+/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
