import { renderToBuffer } from "@react-pdf/renderer";
import type { ReactElement } from "react";

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
