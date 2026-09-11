"use client";

import { useEffect, useRef, useState } from "react";

/**
 * One page of the preview PDF as an image, drawn by pdf.js in the browser.
 *
 * This is what lets the stamp pad be the real page rather than a schematic:
 * the same bytes the preview pane shows, rasterised at 2 px per point, with
 * the page size in points so the editor can map pixels back to the PDF's
 * coordinates exactly.
 */
export type PageRaster = {
  url: string;
  /** Page size in points (A4: 595 × 842). */
  widthPt: number;
  heightPt: number;
  page: number;
  /** The PDF it was drawn from, so a caller can tell when it lags behind. */
  source: Blob;
};

const SCALE = 2;

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

/** Load pdf.js once, with its worker served as a static asset by the bundler. */
function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      return mod;
    });
  }
  return pdfjsPromise;
}

async function rasterise(blob: Blob, page: number): Promise<PageRaster> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await blob.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  try {
    const n = Math.min(Math.max(1, page), doc.numPages);
    const pg = await doc.getPage(n);
    const viewport = pg.getViewport({ scale: SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    await pg.render({ canvasContext: ctx, viewport }).promise;
    const out = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!out) throw new Error("could not encode the page");
    return {
      url: URL.createObjectURL(out),
      widthPt: viewport.width / SCALE,
      heightPt: viewport.height / SCALE,
      page: n,
      source: blob,
    };
  } finally {
    await doc.destroy();
  }
}

/**
 * The requested page of `blob` as an image; `page` ≤ 0 means the last page.
 * Keeps the previous image while a new one renders, so a drag never sees a
 * blank pad.
 */
export function usePageRaster(
  blob: Blob | null,
  page: number,
): PageRaster | null {
  const [raster, setRaster] = useState<PageRaster | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    (async () => {
      try {
        const pdfjs = await loadPdfJs();
        let target = page;
        if (target <= 0) {
          const data = new Uint8Array(await blob.arrayBuffer());
          const doc = await pdfjs.getDocument({ data }).promise;
          target = doc.numPages;
          await doc.destroy();
        }
        const r = await rasterise(blob, target);
        if (cancelled) {
          URL.revokeObjectURL(r.url);
          return;
        }
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = r.url;
        setRaster(r);
      } catch {
        // Leave whatever was there; the pad falls back to its outline.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [blob, page]);

  // Release the last image on unmount.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return raster;
}
