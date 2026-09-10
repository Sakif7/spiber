"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * One editor's pending changes, visible to the rest of the screen.
 *
 * An admin form holds what you type in React state until you press save. Every
 * other control on the page — generate the invoice, move the order on — runs
 * its own request and then refreshes the server components, which leaves that
 * typed-but-unsaved value sitting on screen looking exactly like a saved one.
 * On a sales order that is how a cost price gets typed in, an invoice gets
 * regenerated, and the figure is gone at the next reload with nothing having
 * warned anybody. It happened in production.
 *
 * So the editor publishes whether it is dirty, and the panels beside it can
 * refuse to act on stale figures and offer to save first.
 *
 * A module-level store rather than context because the two components are
 * siblings rendered by a SERVER page, and only one editor is ever on screen.
 * The snapshot is a plain boolean, so React can never see a new object
 * identity and re-render forever; the save callback is kept beside the store
 * rather than inside it for the same reason.
 */

let dirty = false;
let save: (() => void | Promise<void>) | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getSnapshot = () => dirty;
/** The server never has pending edits, so this is always false there. */
const getServerSnapshot = () => false;

/**
 * Publish the editor's state.
 *
 * The callback is refreshed on every render but only a CHANGE to the flag
 * notifies subscribers — re-emitting on each render would loop the panels that
 * read it.
 */
function publish(next: boolean, onSave: (() => void | Promise<void>) | null) {
  save = onSave;
  if (next === dirty) return;
  dirty = next;
  for (const listener of listeners) listener();
}

/**
 * Called by the editor that owns the form.
 *
 * Also guards the browser's own reload and close, which is the exact way the
 * production figure was lost.
 */
export function useUnsavedGuard(
  isDirty: boolean,
  onSave: () => void | Promise<void>,
) {
  useEffect(() => {
    publish(isDirty, onSave);
    return () => publish(false, null);
  });

  useEffect(() => {
    if (!isDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      // Both forms: `preventDefault` is the modern one, `returnValue` is what
      // some browsers still read. The wording is the browser's, not ours.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);
}

/**
 * The same answer, read at the moment it is asked.
 *
 * The hook below is for rendering; this is for a handler, which would
 * otherwise close over whatever the flag was when it was created.
 */
export function hasUnsavedChanges(): boolean {
  return dirty;
}

/** Does the editor on this screen have changes that have not been saved? */
export function useUnsavedChanges(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Save them, from a panel that is not the editor. */
export async function saveUnsavedChanges(): Promise<void> {
  await save?.();
}
