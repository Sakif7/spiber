import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Where a comment sits in the text.
 *
 * A thread is anchored to the words it was written about — the quoted
 * text with a little of what came before and after — never to a mark in
 * the body. The body therefore never changes because someone commented on
 * it (no save race with the author's autosave, nothing to strip before
 * printing), and a comment survives every edit that leaves its words in
 * place. When the words are gone the thread keeps its quote and shows as
 * detached.
 */
export type TextAnchor = {
  /** The commented text; empty for a comment on the document as a whole. */
  quote: string;
  /** Up to CONTEXT characters before and after, to tell repeats apart. */
  prefix: string;
  suffix: string;
  /** Character offset in the flat text when written — the tie-breaker. */
  at: number;
};

export const CONTEXT = 32;
export const MAX_QUOTE = 2000;

/** Inline atoms (a merge field, a footnote) count as one character. */
export const ATOM = "￼";

/**
 * The document as one string, one character per position: `pos[i]` is the
 * ProseMirror position of character `i`. Blocks are joined by a newline
 * that maps to the block's opening position.
 */
export function flatText(doc: PMNode): { text: string; pos: number[] } {
  let text = "";
  const pos: number[] = [];
  doc.descendants((node, p) => {
    if (!node.isTextblock) return true;
    if (text.length) {
      text += "\n";
      pos.push(p);
    }
    node.forEach((child, offset) => {
      const base = p + 1 + offset;
      if (child.isText) {
        const s = child.text ?? "";
        for (let k = 0; k < s.length; k++) {
          text += s[k];
          pos.push(base + k);
        }
      } else {
        for (let k = 0; k < child.nodeSize; k++) {
          text += ATOM;
          pos.push(base + k);
        }
      }
    });
    return false;
  });
  return { text, pos };
}

/** The flat-text index range covering document positions [from, to). */
function indexRange(
  pos: number[],
  from: number,
  to: number,
): { i: number; j: number } {
  let i = 0;
  while (i < pos.length && pos[i] < from) i++;
  let j = i;
  while (j < pos.length && pos[j] < to) j++;
  return { i, j };
}

/** The anchor for a selection, trimmed of the whitespace around it. */
export function anchorFor(doc: PMNode, from: number, to: number): TextAnchor {
  const { text, pos } = flatText(doc);
  const r = indexRange(pos, from, to);
  let i = r.i;
  let j = r.j;
  while (i < j && /\s/.test(text[i])) i++;
  while (j > i && /\s/.test(text[j - 1])) j--;
  const quote = text.slice(i, Math.min(j, i + MAX_QUOTE));
  return {
    quote,
    prefix: text.slice(Math.max(0, i - CONTEXT), i),
    suffix: text.slice(j, j + CONTEXT),
    at: i,
  };
}

function commonSuffixLength(a: string, b: string): number {
  let n = 0;
  while (
    n < a.length &&
    n < b.length &&
    a[a.length - 1 - n] === b[b.length - 1 - n]
  )
    n++;
  return n;
}
function commonPrefixLength(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Where the anchor's words are now, as document positions — or null when
 * they are gone. Among repeats, the one whose surroundings agree most with
 * the stored context wins; a tie goes to the nearest to where it was.
 */
export function locate(
  flat: { text: string; pos: number[] },
  anchor: TextAnchor,
): { from: number; to: number } | null {
  const { text, pos } = flat;
  if (!anchor.quote) return null;
  let best: { i: number; score: number; dist: number } | null = null;
  let i = text.indexOf(anchor.quote);
  while (i !== -1) {
    const before = text.slice(Math.max(0, i - CONTEXT), i);
    const after = text.slice(
      i + anchor.quote.length,
      i + anchor.quote.length + CONTEXT,
    );
    const score =
      commonSuffixLength(before, anchor.prefix) +
      commonPrefixLength(after, anchor.suffix);
    const dist = Math.abs(i - anchor.at);
    if (
      !best ||
      score > best.score ||
      (score === best.score && dist < best.dist)
    )
      best = { i, score, dist };
    i = text.indexOf(anchor.quote, i + 1);
  }
  if (!best) return null;
  const last = best.i + anchor.quote.length - 1;
  return { from: pos[best.i], to: pos[last] + 1 };
}
