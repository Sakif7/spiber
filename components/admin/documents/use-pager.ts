"use client";

import { useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";
import { paginate, type PageMetrics } from "@/lib/documents/pager";

export type PagerState = { pages: number; pageOfBlock: number[] };

/**
 * Runs the shared pager over the editor's DOM after every change (and when
 * fonts or images settle) and applies the resulting pushes through a
 * stylesheet the hook owns. Every run blanks that stylesheet, measures the
 * untouched layout, then writes the pushes back — all inside one animation
 * frame, so nothing is painted in between and the result never depends on
 * the previous one (no feedback loop, whatever rounding or margins do).
 */
export function usePager(
  editor: Editor | null,
  metrics: PageMetrics,
  selector: string,
): PagerState {
  const [state, setState] = useState<PagerState>({
    pages: 1,
    pageOfBlock: [],
  });
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;
    const style = document.createElement("style");
    style.setAttribute("data-doc-pager", "");
    document.head.appendChild(style);

    const run = () => {
      frame.current = null;
      if (editor.isDestroyed) return;
      style.textContent = "";
      const r = paginate(dom, metrics, selector);
      style.textContent = r.css;
      setState((prev) =>
        prev.pages === r.pages &&
        prev.pageOfBlock.length === r.pageOfBlock.length &&
        prev.pageOfBlock.every((p, i) => p === r.pageOfBlock[i])
          ? prev
          : { pages: r.pages, pageOfBlock: r.pageOfBlock },
      );
    };
    const schedule = () => {
      if (frame.current !== null) return;
      frame.current = requestAnimationFrame(run);
    };

    editor.on("update", schedule);
    editor.on("create", schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(dom);
    if (document.fonts?.ready) document.fonts.ready.then(schedule);
    schedule();
    return () => {
      editor.off("update", schedule);
      editor.off("create", schedule);
      ro.disconnect();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      style.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- metrics is compared field by field
  }, [
    editor,
    selector,
    metrics.pageHeight,
    metrics.contentTop,
    metrics.contentBottom,
    metrics.gap,
  ]);

  return state;
}
