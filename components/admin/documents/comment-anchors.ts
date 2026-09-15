"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { flatText, locate, type TextAnchor } from "@/lib/documents/anchors";

/**
 * Comment highlights (screen only — never part of the shared extension
 * list). Each thread is found again in the text after every change by the
 * words it quotes; the ranges are decorations, so the document itself
 * carries nothing. Clicking a highlight makes that thread current, which
 * the panel in the rail follows.
 */
export type ThreadAnchor = TextAnchor & { id: string; resolved: boolean };

export type AnchorsState = {
  threads: ThreadAnchor[];
  current: string | null;
  /** Where each thread's words are now; null when they are gone. */
  ranges: Record<string, { from: number; to: number } | null>;
};

export const anchorsKey = new PluginKey<AnchorsState>("commentAnchors");

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    commentAnchors: {
      setCommentThreads: (threads: ThreadAnchor[]) => ReturnType;
      setCurrentComment: (id: string | null) => ReturnType;
    };
  }
  interface Storage {
    commentAnchors: { current: string | null; listeners: Set<() => void> };
  }
}

type Meta = { threads?: ThreadAnchor[]; current?: string | null };

export const CommentAnchors = Extension.create<
  Record<string, never>,
  { current: string | null; listeners: Set<() => void> }
>({
  name: "commentAnchors",

  addStorage() {
    return { current: null, listeners: new Set<() => void>() };
  },

  addCommands() {
    const storage = this.storage;
    return {
      setCommentThreads:
        (threads) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(anchorsKey, { threads } as Meta));
          return true;
        },
      setCurrentComment:
        (id) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(anchorsKey, { current: id } as Meta));
            if (storage.current !== id) {
              storage.current = id;
              storage.listeners.forEach((l) => l());
            }
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    const empty: AnchorsState = { threads: [], current: null, ranges: {} };
    return [
      new Plugin<AnchorsState>({
        key: anchorsKey,
        state: {
          init: () => empty,
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(anchorsKey) as Meta | undefined;
            let next = prev;
            if (meta?.threads) next = { ...next, threads: meta.threads };
            if (meta && "current" in meta)
              next = { ...next, current: meta.current ?? null };
            if (meta?.threads || tr.docChanged) {
              const flat = flatText(newState.doc);
              const ranges: AnchorsState["ranges"] = {};
              for (const t of next.threads) ranges[t.id] = locate(flat, t);
              next = { ...next, ranges };
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = anchorsKey.getState(state);
            if (!s || s.threads.length === 0) return DecorationSet.empty;
            const decos: Decoration[] = [];
            for (const t of s.threads) {
              const r = s.ranges[t.id];
              if (!r) continue;
              const current = t.id === s.current;
              if (t.resolved && !current) continue;
              decos.push(
                Decoration.inline(r.from, r.to, {
                  class: current
                    ? "doc-comment-hl is-current"
                    : "doc-comment-hl",
                  "data-comment": t.id,
                }),
              );
            }
            return DecorationSet.create(state.doc, decos);
          },
          // A click on a highlight makes its thread current.
          handleClick(view, pos) {
            const s = anchorsKey.getState(view.state);
            if (!s) return false;
            const hit = s.threads.find((t) => {
              const r = s.ranges[t.id];
              return r && !t.resolved && pos >= r.from && pos <= r.to;
            });
            if (!hit || hit.id === s.current) return false;
            view.dispatch(
              view.state.tr.setMeta(anchorsKey, { current: hit.id } as Meta),
            );
            storage.current = hit.id;
            storage.listeners.forEach((l) => l());
            return false;
          },
        },
      }),
    ];
  },
});
