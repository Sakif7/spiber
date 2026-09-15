"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EditorContent, type Editor } from "@tiptap/react";
import {
  documentCss,
  pageChromeHtml,
  type ChromeInput,
} from "@/lib/documents/chrome";
import { PAGE } from "@/lib/documents/types";
import { PageFootnotes } from "./footnotes";
import type { PagerState } from "./use-pager";

export const ZOOMS = [
  { value: "fit", label: "Fit" },
  { value: "0.75", label: "75%" },
  { value: "1", label: "100%" },
  { value: "1.25", label: "125%" },
];

/**
 * The A4 pages on the grey desk: the company chrome per page, the editor's
 * one column laid over them, the footnotes at each foot — scaled to the
 * zoom. Shared by the writing desk and the reviewer's desk so both show
 * exactly the same pages; anything drawn over the pages (a popover, the
 * comment bubble) comes in as children, in the stack's own coordinates.
 */
export function PageStack({
  editor,
  pager,
  contentBottom,
  chrome,
  zoom,
  children,
}: {
  editor: Editor | null;
  pager: PagerState;
  contentBottom: number;
  chrome: ChromeInput;
  zoom: string;
  children?: ReactNode;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(0);
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setCanvasWidth(el.clientWidth));
    ro.observe(el);
    setCanvasWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const css = useMemo(
    () => documentCss(chrome.settings, { screen: true }),
    [chrome.settings],
  );
  const pagesHtml = useMemo(() => {
    let html = "";
    for (let p = 1; p <= pager.pages; p++)
      html += pageChromeHtml(chrome, p, pager.pages);
    return html;
  }, [chrome, pager.pages]);

  const scale =
    zoom === "fit"
      ? Math.min(1, Math.max(0.4, (canvasWidth - 48) / PAGE.width))
      : Number(zoom);
  const stackHeight =
    pager.pages * PAGE.height + (pager.pages - 1) * PAGE.screenGap;

  return (
    <div ref={canvasRef} className="doc-canvas min-w-0 flex-1 overflow-auto">
      <style>{css}</style>
      <style>{STACK_CSS}</style>
      <div
        className="mx-auto"
        style={{
          width: PAGE.width * scale,
          height: stackHeight * scale + 48,
          paddingTop: 24,
        }}
      >
        <div
          className="doc-pages"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            height: stackHeight,
          }}
        >
          <div aria-hidden dangerouslySetInnerHTML={{ __html: pagesHtml }} />
          <EditorContent editor={editor} />
          <PageFootnotes
            editor={editor}
            pager={pager}
            contentBottom={contentBottom}
          />
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Where a point on screen sits inside the page stack, in the stack's own
 * (unscaled) coordinates — for anything positioned over the pages.
 */
export function stackPoint(
  stack: HTMLElement,
  x: number,
  y: number,
): { left: number; top: number } {
  const s = stack.getBoundingClientRect();
  const scale = s.width / stack.offsetWidth || 1;
  return { left: (x - s.left) / scale, top: (y - s.top) / scale };
}

/** Screen-only styling: the grey desk, the page shadow, the editor chrome. */
const STACK_CSS = `
.doc-canvas{background:var(--color-surface-2);overflow-anchor:none}
.dark .doc-canvas{background:#1a272c}
.doc-pages{position:relative}
.doc-pages .doc-column{z-index:1}
.doc-pages .doc-page{z-index:0}
.doc-pages .doc-column.ProseMirror{position:absolute}
.doc-text p.is-editor-empty:first-child::before{content:attr(data-placeholder);color:#9aa5a9;float:left;height:0;pointer-events:none}
.doc-pages .doc-page-break{height:0;margin:0!important;border-top:1px dashed #0d8f91}
.doc-pages .doc-page-break::after{content:"page break";position:absolute;right:0;top:-9px;font:600 9px/1 "IBM Plex Sans",sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#0d8f91;background:#fff;padding:2px 6px}
.doc-pages .ProseMirror-selectednode{outline:2px solid #0d8f91;outline-offset:2px}
.doc-pages .selectedCell::after{content:"";position:absolute;inset:0;background:rgba(13,143,145,.12);pointer-events:none}
.doc-pages .column-resize-handle{position:absolute;right:-2px;top:0;bottom:0;width:4px;background:#0d8f91;pointer-events:none}
.doc-pages .tableWrapper{overflow:visible}
.doc-pages .resize-cursor{cursor:col-resize}
.doc-pages img.ProseMirror-selectednode{outline:2px solid #0d8f91}
.doc-pages .doc-search-hit{background:#fde68a;border-radius:2px}
.doc-pages .doc-search-hit.is-current{background:#f59e0b;color:#fff}
.doc-pages .doc-comment-hl{background:#fef3c7;border-bottom:2px solid #f59e0b;cursor:pointer}
.doc-pages .doc-comment-hl.is-current{background:#fde68a}
`;
