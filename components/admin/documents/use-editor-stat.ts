"use client";

import { useCallback, useRef, useSyncExternalStore } from "react";
import type { Editor } from "@tiptap/react";

/**
 * A value derived from the editor's document, recomputed after every
 * change to it — and computed as soon as the editor exists.
 *
 * TipTap's `useEditorState` keeps the snapshot it took when the editor was
 * still `null` (Next.js renders the editor after mount) until the first
 * transaction, so a freshly loaded document showed no outline and 0 words.
 */
export function useEditorStat<T>(
  editor: Editor | null,
  compute: (editor: Editor) => T,
  empty: T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const version = useRef(0);
  const cache = useRef<{ editor: Editor | null; version: number; value: T }>({
    editor: null,
    version: -1,
    value: empty,
  });
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!editor) return () => undefined;
      const bump = () => {
        version.current += 1;
        onChange();
      };
      editor.on("update", bump);
      return () => {
        editor.off("update", bump);
      };
    },
    [editor],
  );
  const getSnapshot = () => {
    const c = cache.current;
    if (c.editor === editor && c.version === version.current) return c.value;
    const value = editor && !editor.isDestroyed ? compute(editor) : empty;
    const next = isEqual(c.value, value) ? c.value : value;
    cache.current = { editor, version: version.current, value: next };
    return next;
  };
  return useSyncExternalStore(subscribe, getSnapshot, () => empty);
}
