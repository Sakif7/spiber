import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { FIT_LEVELS, type PageFit, type Paginated } from "./engine/fit";

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
 * Render a template document so a small one prints on ONE page.
 *
 * `make` builds the document for a given fit (pass it to the document's
 * `fit` prop). The layout is decided from how the pages actually came out,
 * never from an estimate (see `lib/pdf/engine/fit.ts`):
 *
 * 1. As designed. One page — done, and printed exactly as it always was.
 * 2. Two pages: laid out again a level tighter at a time — spacing, then the
 *    text half a point, then a point — and the first that fits on one page
 *    is the document.
 * 3. Still more than a page: it is a long document. It prints as designed
 *    with everything after its last table travelling with the table's
 *    closing rows, so the next page opens with rows rather than with the
 *    terms and the signature alone. That piece is measured first, on an
 *    unbroken sheet: react-pdf does not refuse a piece taller than a page,
 *    it squeezes every row in it to fit, so a template whose tail no page
 *    can hold keeps the plain layout, which at least loses nothing.
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
    let seen: Paginated = { pages: 1, flowArea: null, tailHeight: null };
    const pdf = await renderPdf(make({ ...fit, report: (p) => (seen = p) }));
    return { pdf, fit, ...seen };
  };

  const designed = await attempt({ level: 0 });
  if (designed.pages <= 1) return designed;

  // Three pages or more cannot be pulled back onto one by spacing alone.
  if (designed.pages === 2) {
    for (const level of FIT_LEVELS) {
      const fitted = await attempt({ level });
      if (fitted.pages <= 1) return fitted;
    }
  }

  const tail = { level: 0, tailWithTable: true } as const;
  const measured = await attempt({ ...tail, measure: true });
  const fits =
    measured.tailHeight != null &&
    designed.flowArea != null &&
    measured.tailHeight <= designed.flowArea;
  return fits ? attempt(tail) : designed;
}
