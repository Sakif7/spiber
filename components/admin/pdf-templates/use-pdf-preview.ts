"use client";

import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@/lib/use-debounced-callback";
import { formatApiError } from "@/lib/http/form-error";
import type { TemplateDoc, TemplateKind } from "@/lib/schemas/pdf-template";

/** Where a block landed in the rendered preview, in page points. */
export type PreviewBox = {
  id: string;
  /** 1-based. */
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export type PdfPreview = {
  /** The document JSON this preview was rendered from. */
  json: string;
  url: string | null;
  blob: Blob | null;
  boxes: PreviewBox[];
  error: string | null;
  /** The document has changed since this preview was rendered. */
  stale: boolean;
};

/**
 * The live preview: the document being edited, rendered with sample data by
 * the server. One render feeds both the preview pane and the stamp pad — the
 * pad rasterises the same PDF and reads the block boxes the server reports,
 * so what it shows under a stamp is exactly what the PDF shows.
 *
 * Edits are debounced, an in-flight render is abandoned when a newer edit
 * arrives, and a failed render keeps the last good page up with the error
 * beside it — a broken draft must never blank the preview.
 */
export function usePdfPreview(
  kind: TemplateKind,
  doc: TemplateDoc,
): PdfPreview {
  const [rendered, setRendered] = useState<Omit<PdfPreview, "stale">>({
    json: "",
    url: null,
    blob: null,
    boxes: [],
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);
  const urlRef = useRef<string | null>(null);

  const request = useDebouncedCallback((json: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    fetch("/api/admin/company/pdf-templates/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, template: JSON.parse(json) }),
      signal: ac.signal,
    })
      .then(
        async (
          res,
        ): Promise<{ blob: Blob; boxes: PreviewBox[] } | { err: string }> => {
          if (res.ok) {
            let boxes: PreviewBox[] = [];
            try {
              boxes = JSON.parse(res.headers.get("X-Block-Boxes") ?? "[]");
            } catch {
              boxes = [];
            }
            return { blob: await res.blob(), boxes };
          }
          const body = await res.json().catch(() => null);
          return { err: formatApiError(body) };
        },
      )
      .then((out) => {
        if (ac.signal.aborted) return;
        if ("blob" in out) {
          const url = URL.createObjectURL(out.blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setRendered({
            json,
            url,
            blob: out.blob,
            boxes: out.boxes,
            error: null,
          });
        } else {
          setRendered((prev) => ({ ...prev, json, error: out.err }));
        }
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setRendered((prev) => ({
          ...prev,
          json,
          error: e instanceof Error ? e.message : "Preview failed",
        }));
      });
  }, 600);

  const currentJson = JSON.stringify(doc);
  useEffect(() => {
    request(currentJson);
  }, [currentJson, request]);

  // Release the last object URL and any in-flight request on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return { ...rendered, stale: rendered.json !== currentJson };
}
