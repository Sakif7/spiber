import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import type { PageFit, Paginated } from "./engine/fit";

/**
 * Render a document to a PDF buffer.
 *
 * One renderer for both uses: the buffer is streamed to the browser when an
 * admin opens a document, and attached to the email when it is sent — so what
 * the client receives is byte-for-byte what the admin saw.
 */
export async function renderPdf(element: ReactElement): Promise<Buffer> {
  // The typings model a JSX.Element from react-pdf's own React copy; the
  // element is a plain React element either way.
  return renderToBuffer(element as never);
}

/**
 * Render a template document on as few pages as it needs.
 *
 * `make` builds the document for a given fit (pass it to the document's
 * `fit` prop). The layout is decided from how the pages actually came out,
 * never from an estimate (see `lib/pdf/engine/fit.ts`):
 *
 * 1. As designed. One page — done, and printed exactly as it always was.
 * 2. More than one: the fewest pages any level reaches, with the least
 *    tightening that reaches them — spacing first, then the text half a
 *    point, then a point. A small document lands on one page; a 36-line
 *    proposal whose last row and terms spilled onto a third page lands on
 *    two. A document no level shortens keeps its designed layout.
 * 3. If that layout's last page carries no table rows — only the terms and
 *    the signature — everything after the last table travels with the
 *    table's closing rows instead, so the last page opens with rows. That
 *    piece is measured first, on an unbroken sheet: react-pdf does not
 *    refuse a piece taller than a page, it squeezes every row in it to fit,
 *    so a template whose tail no page can hold keeps the plain layout, which
 *    at least loses nothing.
 *
 * Deterministic: the same data and template always come out the same, so
 * a reprint of a stored version reproduces the document that was sent.
 */
export async function renderFitted(
  make: (fit: PageFit) => ReactElement,
): Promise<Buffer> {
  return (await fitDocument(make)).pdf;
}

/** `renderFitted`, also saying which layout was chosen. */
export async function fitDocument(
  make: (fit: PageFit) => ReactElement,
): Promise<{ pdf: Buffer; fit: Omit<PageFit, "report">; pages: number }> {
  const attempt = async (fit: Omit<PageFit, "report">) => {
    // A document that is not a template one never reports; it is one page
    // as far as this loop is concerned, and is returned as rendered.
    let seen: Paginated = {
      pages: 1,
      flowArea: null,
      tailHeight: null,
      hasTable: false,
      lastPageHasRows: false,
    };
    const pdf = await renderPdf(make({ ...fit, report: (p) => (seen = p) }));
    return { pdf, fit, ...seen };
  };

  const designed = await attempt({ level: 0 });
  if (designed.pages <= 1) return designed;

  // The fewest pages, the least tightening. The floor goes first: when even
  // it saves no page, nothing tighter is worth printing. Otherwise the first
  // level that does as well as the floor is the one used.
  let best = designed;
  const floor = await attempt({ level: 3 });
  if (floor.pages < designed.pages) {
    best = floor;
    for (const level of [1, 2] as const) {
      const tighter = await attempt({ level });
      if (tighter.pages <= floor.pages) {
        best = tighter;
        break;
      }
    }
  }

  // A last page with rows on it, or one page, or no table to bring rows
  // from: done.
  if (best.pages <= 1 || !best.hasTable || best.lastPageHasRows) return best;

  // The last page holds only the closing parts: bring the table's last rows
  // over with them, if the piece fits a page whole.
  const glued = { level: best.fit.level, tailWithTable: true } as const;
  const measured = await attempt({ ...glued, measure: true });
  if (
    measured.tailHeight == null ||
    best.flowArea == null ||
    measured.tailHeight > best.flowArea
  ) {
    return best;
  }
  const carried = await attempt(glued);
  // Carrying rows over moves them to a page that was printing anyway, so it
  // never adds one; should it ever, the plain layout stands.
  return carried.pages <= best.pages ? carried : best;
}
