import type React from "react";
import type {
  Block,
  BlockOf,
  BlockType,
  TemplateKind,
} from "@/lib/schemas/pdf-template";
import type { RenderContext } from "../context";
import type { Styles } from "../theme";

/** What every block component receives. */
export type BlockProps<T extends BlockType> = {
  block: BlockOf<T>;
  styles: Styles;
  ctx: RenderContext;
  kind: TemplateKind;
};

/**
 * What a table block receives: on a document too long for one page, the
 * rest of the document rides in its closing rows (`PagedTable`'s `after`).
 */
export type TableBlockProps<T extends BlockType> = BlockProps<T> & {
  after?: React.ReactNode;
};

type Style = Record<string, string | number>;

/**
 * The block's own style knobs as a react-pdf style object, with only the keys
 * that were set — so a block with no style contributes nothing, exactly as the
 * hand-written elements that had no style prop.
 */
export function frameStyle(block: Block, styles: Styles): Style {
  const s = block.style;
  if (!s) return {};
  const out: Style = {};
  if (s.marginTop != null) out.marginTop = s.marginTop;
  if (s.marginBottom != null) out.marginBottom = s.marginBottom;
  if (s.fontSize != null) out.fontSize = s.fontSize;
  if (s.align) out.textAlign = s.align;
  if (s.muted) out.color = styles.muted.color as string;
  return out;
}

/** `wrap` / `minPresenceAhead`, passed only when the block sets them. */
export function frameProps(block: Block): {
  wrap?: boolean;
  minPresenceAhead?: number;
} {
  const out: { wrap?: boolean; minPresenceAhead?: number } = {};
  if (block.keepTogether) out.wrap = false;
  if (block.minPresenceAhead != null)
    out.minPresenceAhead = block.minPresenceAhead;
  return out;
}
