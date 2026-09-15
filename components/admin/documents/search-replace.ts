"use client";

import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Find & replace for the editor (screen only — never part of the shared
 * list). Matches are decorations, recomputed after every change; the
 * current one is highlighted more strongly and scrolled to.
 */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchReplace: {
      setSearch: (opts: {
        term?: string;
        replace?: string;
        caseSensitive?: boolean;
      }) => ReturnType;
      nextMatch: () => ReturnType;
      prevMatch: () => ReturnType;
      replaceMatch: () => ReturnType;
      replaceAllMatches: () => ReturnType;
    };
  }
}

export type SearchState = {
  term: string;
  replace: string;
  caseSensitive: boolean;
  matches: { from: number; to: number }[];
  index: number;
};

export const searchKey = new PluginKey<SearchState>("searchReplace");

/**
 * Every match in the document. Text is gathered per textblock with one
 * character per position — an inline atom (a merge field) counts as one —
 * so an index in the gathered text maps straight to a document position.
 */
function findMatches(
  doc: PMNode,
  term: string,
  caseSensitive: boolean,
): { from: number; to: number }[] {
  const out: { from: number; to: number }[] = [];
  if (!term) return out;
  const needle = caseSensitive ? term : term.toLowerCase();
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    let text = "";
    node.forEach((child) => {
      if (child.isText) text += child.text ?? "";
      else text += "￼".repeat(child.nodeSize);
    });
    const hay = caseSensitive ? text : text.toLowerCase();
    let i = hay.indexOf(needle);
    while (i !== -1) {
      out.push({ from: pos + 1 + i, to: pos + 1 + i + term.length });
      i = hay.indexOf(needle, i + Math.max(1, term.length));
    }
    return false;
  });
  return out;
}

export const SearchReplace = Extension.create({
  name: "searchReplace",

  addCommands() {
    return {
      setSearch:
        (opts) =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { set: opts }));
          return true;
        },
      nextMatch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { step: 1 }));
          return true;
        },
      prevMatch:
        () =>
        ({ tr, dispatch }) => {
          if (dispatch) dispatch(tr.setMeta(searchKey, { step: -1 }));
          return true;
        },
      replaceMatch:
        () =>
        ({ state, tr, dispatch }) => {
          const s = searchKey.getState(state);
          const m = s?.matches[s.index];
          if (!s || !m) return false;
          if (dispatch) {
            tr.insertText(s.replace, m.from, m.to);
            // The same index now points at the next match.
            dispatch(tr.setMeta(searchKey, { keepIndex: true }));
          }
          return true;
        },
      replaceAllMatches:
        () =>
        ({ state, tr, dispatch }) => {
          const s = searchKey.getState(state);
          if (!s || s.matches.length === 0) return false;
          if (dispatch) {
            // From the back, so earlier positions stay valid.
            for (const m of [...s.matches].reverse()) {
              tr.insertText(s.replace, m.from, m.to);
            }
            dispatch(tr);
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const empty: SearchState = {
      term: "",
      replace: "",
      caseSensitive: false,
      matches: [],
      index: 0,
    };
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => empty,
          apply(tr, prev, _old, newState) {
            const meta = tr.getMeta(searchKey) as
              | {
                  set?: Partial<SearchState>;
                  step?: number;
                  keepIndex?: boolean;
                }
              | undefined;
            let next: SearchState = prev;
            if (meta?.set) next = { ...prev, ...meta.set };
            if (meta?.set || tr.docChanged) {
              const matches = findMatches(
                newState.doc,
                next.term,
                next.caseSensitive,
              );
              let index = next.index;
              if (meta?.set?.term !== undefined && meta.set.term !== prev.term)
                index = 0;
              if (meta?.keepIndex) index = Math.min(index, matches.length - 1);
              next = {
                ...next,
                matches,
                index: Math.max(0, Math.min(index, matches.length - 1)),
              };
            }
            if (meta?.step && next.matches.length) {
              const n = next.matches.length;
              next = { ...next, index: (next.index + meta.step + n) % n };
            }
            return next;
          },
        },
        props: {
          decorations(state) {
            const s = searchKey.getState(state);
            if (!s || s.matches.length === 0) return DecorationSet.empty;
            return DecorationSet.create(
              state.doc,
              s.matches.map((m, i) =>
                Decoration.inline(m.from, m.to, {
                  class:
                    i === s.index
                      ? "doc-search-hit is-current"
                      : "doc-search-hit",
                }),
              ),
            );
          },
        },
        // Put the caret on the current match after a step, so it scrolls into view.
        appendTransaction(trs, _old, newState) {
          const stepped = trs.some((t) => {
            const m = t.getMeta(searchKey) as
              | { step?: number; set?: unknown }
              | undefined;
            return Boolean(m?.step || m?.set);
          });
          if (!stepped) return null;
          const s = searchKey.getState(newState);
          const m = s?.matches[s.index];
          if (!m) return null;
          return newState.tr
            .setSelection(TextSelection.create(newState.doc, m.from, m.to))
            .scrollIntoView();
        },
      }),
    ];
  },
});
