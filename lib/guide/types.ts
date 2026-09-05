/**
 * Shared shape for the two written guides: the customer-facing user guide on
 * the public site, and the super-admin guide inside the admin. Both are plain
 * data so the same renderer works for either, and so the copy can be reviewed
 * (or translated) without touching layout code.
 */

/** One screenshot with the sentence that explains what the reader is seeing. */
export type GuideFigure = {
  /** File name under /public/guide (user guide) or /public/guide/admin. */
  src: string;
  caption: string;
  /** Wider than the text column — use for full-page screenshots. */
  wide?: boolean;
};

export type GuideBlock =
  | { kind: "text"; body: string }
  /** A numbered sequence the reader is meant to follow in order. */
  | { kind: "steps"; steps: string[] }
  /** Unordered points: options, rules, things to know. */
  | { kind: "list"; items: string[] }
  /** Label/description pairs — statuses, fields, settings. */
  | { kind: "definitions"; items: { term: string; def: string }[] }
  /** Something the reader must not get wrong. */
  | { kind: "callout"; tone: "note" | "warning"; title?: string; body: string }
  | { kind: "figure"; figure: GuideFigure };

export type GuideSection = {
  /** Anchor id, used by the contents list. */
  id: string;
  title: string;
  /** One sentence under the heading saying what the section is for. */
  lede?: string;
  blocks: GuideBlock[];
};

export type Guide = {
  title: string;
  lede: string;
  /** Shown under the lede, e.g. when the guide was last checked. */
  updated?: string;
  sections: GuideSection[];
};
