import { fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { logger } from "@/lib/log";
import { renderPdf } from "@/lib/pdf/render";
import { fixtureElement } from "@/lib/pdf/engine/fixtures";
import type { BlockBox } from "@/lib/pdf/engine/render-template";
import { previewInputSchema, stampAssetIds } from "@/lib/schemas/pdf-template";
import { loadAssets } from "@/lib/services/pdf-asset.service";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/**
 * Render a template being edited, with sample data, for the editor's preview.
 *
 * Nothing is stored and no real order is read: the sample is made up, so the
 * preview can never leak a client's pricing. The renderer is CPU-bound, hence
 * the tighter rate limit; the editor debounces on its side too.
 */
export async function POST(req: Request) {
  const g = await guardSales("pdf-preview", 30);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, previewInputSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  const { kind, template } = parsed.data;

  let pdf: Buffer;
  let boxes: BlockBox[] = [];
  try {
    const assets = await loadAssets(stampAssetIds(template));
    pdf = await renderPdf(
      fixtureElement(kind, template, assets, (b) => {
        boxes = b;
      }),
    );
  } catch (err) {
    logger.warn("pdf-template preview failed", { kind, err });
    return fail(
      {
        code: "render_failed",
        message: err instanceof Error ? err.message : "Could not render",
      },
      422,
    );
  }

  return new Response(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${kind}-preview.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      // Where every block landed (page, points), so the editor can draw the
      // real page under a stamp being positioned.
      "X-Block-Boxes": JSON.stringify(
        boxes.map((b) => ({
          id: b.blockId,
          page: b.page,
          left: Math.round(b.left * 100) / 100,
          top: Math.round(b.top * 100) / 100,
          width: Math.round(b.width * 100) / 100,
          height: Math.round(b.height * 100) / 100,
        })),
      ),
    },
  });
}
