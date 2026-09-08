"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { refKey, type ItemRef } from "./types";

/**
 * Explorer-style multi-select.
 *
 * The rules people already expect from a file manager: a plain click replaces
 * the selection, Ctrl/Cmd-click toggles one item, and Shift-click extends from
 * the last item clicked (the"anchor") to the one under the cursor — using the
 * order the items are currently displayed in, not the order they were created.
 *
 * `order` is the flattened, currently-visible list (folders then files), so the
 * range a Shift-click selects follows what the user can actually see.
 */
export function useSelection(order: ItemRef[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const anchorRef = useRef<string | null>(null);

  const keys = useMemo(() => order.map(refKey), [order]);

  const isSelected = useCallback(
    (ref: ItemRef) => selected.has(refKey(ref)),
    [selected],
  );

  const click = useCallback(
    (ref: ItemRef, mods: { shift?: boolean; ctrl?: boolean } = {}) => {
      const key = refKey(ref);
      // The anchor moves for every click except a Shift-extend, which measures
      // FROM the anchor. Decided here rather than inside the state updater: an
      // updater can run twice in development, and it must stay pure.
      const anchor = anchorRef.current;
      const shiftRange =
        mods.shift && anchor ? [keys.indexOf(anchor), keys.indexOf(key)] : null;
      if (!shiftRange || shiftRange[0]! < 0 || shiftRange[1]! < 0) {
        anchorRef.current = key;
      }

      setSelected((prev) => {
        if (shiftRange && shiftRange[0]! >= 0 && shiftRange[1]! >= 0) {
          const [from, to] = shiftRange as [number, number];
          const [lo, hi] = from <= to ? [from, to] : [to, from];
          // Shift extends the existing selection when combined with Ctrl,
          // and replaces it otherwise.
          const next = new Set(mods.ctrl ? prev : []);
          for (let i = lo; i <= hi; i++) next.add(keys[i]!);
          return next;
        }
        if (mods.ctrl) {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        }
        return new Set([key]);
      });
    },
    [keys],
  );

  const selectAll = useCallback(() => setSelected(new Set(keys)), [keys]);

  const clear = useCallback(() => {
    anchorRef.current = null;
    setSelected(new Set());
  }, []);

  /** Ensure `ref` is part of the selection — used before a context-menu action. */
  const ensure = useCallback((ref: ItemRef) => {
    const key = refKey(ref);
    anchorRef.current = key;
    setSelected((prev) => (prev.has(key) ? prev : new Set([key])));
  }, []);

  const refs = useMemo(
    () => order.filter((r) => selected.has(refKey(r))),
    [order, selected],
  );

  return {
    selected,
    refs,
    count: refs.length,
    isSelected,
    click,
    selectAll,
    clear,
    ensure,
    folderIds: refs.filter((r) => r.kind === "folder").map((r) => r.id),
    fileIds: refs.filter((r) => r.kind === "file").map((r) => r.id),
  };
}
