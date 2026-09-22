import React from "react";
import { Document, Page, Font } from "@react-pdf/renderer";
import {
  FIXED_BLOCK_TYPES,
  OVERLAY_BLOCK_TYPES,
  type Block,
  type BlockOf,
  type TemplateDoc,
  type TemplateKind,
} from "@/lib/schemas/pdf-template";
import type { RenderContext } from "./context";
import { interpolate, isShown } from "./resolve";
import { makeStyles, type Styles } from "./theme";
import {
  FooterBandBlock,
  LetterheadBlock,
  WatermarkBlock,
} from "./blocks/stationery";
import {
  HeadingBlock,
  LabelledTextBlock,
  PageBreakBlock,
  ParagraphBlock,
  SpacerBlock,
  TitleBlock,
} from "./blocks/text";
import {
  BulletsBlock,
  KeyValueListBlock,
  KeyValueTableBlock,
  LabelledListBlock,
  MetaColumnsBlock,
} from "./blocks/lists";
import { LineTableBlock } from "./blocks/line-table";
import { EquipmentTableBlock } from "./blocks/equipment-table";
import { SignOffBlock } from "./blocks/sign-off";
import { AnchoredStamp, PageStamp } from "./blocks/stamp";
import type { StampAssets } from "../types";
import { View } from "@react-pdf/renderer";

/**
 * The template engine: a document is its theme and an ordered list of blocks.
 *
 * Stationery (watermark, letterhead, footer band) is painted in a fixed order
 * around the flow blocks whatever the array says, so the editor can never
 * produce a page with the watermark over the text. Every block is skipped
 * when hidden or when its `showIf` path comes back empty.
 *
 * The built-in Times and Helvetica faces are used throughout — they need no
 * font files and are guaranteed to render, which matters for a document a
 * client receives. Note they have no ৳ glyph, so money prints as grouped
 * numbers under a "(BDT)" heading, exactly as the samples do.
 */

/**
 * No mid-word breaking.
 *
 * The renderer hyphenates by a generic algorithm, not a dictionary, so a spec
 * line came out as "Pow-er", "Tempera-ture", "Warran-ty". On a document a
 * client receives that reads as a typo. Returning the word whole tells the
 * renderer to wrap between words instead. Process-wide, registered once here
 * because every document goes through this module.
 */
Font.registerHyphenationCallback((word) => [word]);

type Common = { styles: Styles; ctx: RenderContext; kind: TemplateKind };

function FlowBlock({ block, ...rest }: { block: Block } & Common) {
  switch (block.type) {
    case "title":
      return <TitleBlock block={block} {...rest} />;
    case "heading":
      return <HeadingBlock block={block} {...rest} />;
    case "paragraph":
      return <ParagraphBlock block={block} {...rest} />;
    case "labelledText":
      return <LabelledTextBlock block={block} {...rest} />;
    case "metaColumns":
      return <MetaColumnsBlock block={block} {...rest} />;
    case "lineTable":
      return <LineTableBlock block={block} {...rest} />;
    case "equipmentTable":
      return <EquipmentTableBlock block={block} {...rest} />;
    case "labelledList":
      return <LabelledListBlock block={block} {...rest} />;
    case "bullets":
      return <BulletsBlock block={block} {...rest} />;
    case "keyValueList":
      return <KeyValueListBlock block={block} {...rest} />;
    case "keyValueTable":
      return <KeyValueTableBlock block={block} {...rest} />;
    case "signOff":
      return <SignOffBlock block={block} {...rest} />;
    case "spacer":
      return <SpacerBlock block={block} {...rest} />;
    case "pageBreak":
      return <PageBreakBlock />;
    case "stamp":
      // Drawn by the overlay pass, never in the flow.
      return null;
    default:
      return null;
  }
}

/** Where a block landed once the document was paginated, in page points. */
export type BlockBox = {
  blockId: string;
  /** 1-based. */
  page: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

/** The prop the renderer stamps on a block's root so it can be found again. */
const BLOCK_MARK = "data-block-id";

/**
 * Walk react-pdf's laid-out tree and report every marked block's box.
 *
 * Boxes on the laid-out tree are absolute within their page (the renderer
 * translates by `box.left/top` from the page origin), which is exactly what
 * the editor needs to draw the real page under a stamp.
 */
export function collectBlockBoxes(layout: unknown): BlockBox[] {
  type Node = {
    type?: string;
    props?: Record<string, unknown>;
    box?: { left: number; top: number; width: number; height: number };
    children?: Node[];
  };
  const out: BlockBox[] = [];
  const root = layout as Node;
  (root.children ?? []).forEach((page, i) => {
    const walk = (n: Node) => {
      const id = n.props?.[BLOCK_MARK];
      if (typeof id === "string" && n.box && Number.isFinite(n.box.top)) {
        const { left, top, width, height } = n.box;
        out.push({ blockId: id, page: i + 1, left, top, width, height });
      }
      (n.children ?? []).forEach(walk);
    };
    walk(page);
  });
  return out;
}

export function TemplateDocument({
  kind,
  template,
  ctx,
  assets = {},
  onLayout,
}: {
  kind: TemplateKind;
  template: TemplateDoc;
  ctx: RenderContext;
  /** Decrypted stamp images, keyed by asset id; a missing one is not drawn. */
  assets?: StampAssets;
  /** Receives where every flow block landed, once the PDF is laid out. */
  onLayout?: (boxes: BlockBox[]) => void;
}) {
  const styles = makeStyles(template.theme);
  const visible = template.blocks.filter(
    (b) => !b.hidden && isShown(ctx, b.showIf),
  );
  const find = <T extends Block["type"]>(type: T) =>
    visible.find((b): b is BlockOf<T> => b.type === type);
  const watermark = find("watermark");
  const letterhead = find("letterhead");
  const footer = find("footerBand");
  const flow = visible.filter(
    (b) => !FIXED_BLOCK_TYPES.has(b.type) && !OVERLAY_BLOCK_TYPES.has(b.type),
  );
  const stamps = visible.filter(
    (b): b is BlockOf<"stamp"> => b.type === "stamp",
  );
  const pageStamps = stamps.filter((s) => s.props.anchor !== "block");
  // Stamps riding on a block, keyed by that block. One whose block is gone
  // (deleted after the stamp was attached) is simply not drawn.
  const anchored = new Map<string, BlockOf<"stamp">[]>();
  for (const s of stamps) {
    if (s.props.anchor !== "block" || !s.props.blockId) continue;
    anchored.set(s.props.blockId, [
      ...(anchored.get(s.props.blockId) ?? []),
      s,
    ]);
  }
  const common: Common = { styles, ctx, kind };

  /**
   * A block with stamps attached gets a relative wrapper for them to sit in,
   * and so does every block when the editor asks where things landed. Only
   * then — an unwrapped block lays out exactly as it always did. The wrapper
   * refuses to split when the block itself does, so a signature can never be
   * left on the page before its signature line.
   */
  const flowNode = (b: Block) => {
    const riders = anchored.get(b.id) ?? [];
    const node = <FlowBlock key={b.id} block={b} {...common} />;
    if (riders.length === 0 && !onLayout) return node;
    const keep = b.keepTogether || b.type === "signOff";
    return (
      <View
        key={b.id}
        {...{ [BLOCK_MARK]: b.id }}
        style={{ position: "relative" }}
        wrap={!keep}
        minPresenceAhead={b.minPresenceAhead}
      >
        {node}
        {riders.map((s) => (
          <AnchoredStamp key={s.id} block={s} asset={assets[s.props.assetId]} />
        ))}
      </View>
    );
  };

  return (
    <Document
      title={interpolate(template.documentTitle, ctx, kind)}
      onRender={
        onLayout
          ? (p) =>
              onLayout(
                collectBlockBoxes(
                  (p as { _INTERNAL__LAYOUT__DATA_?: unknown })
                    ._INTERNAL__LAYOUT__DATA_,
                ),
              )
          : undefined
      }
    >
      <Page size="A4" style={styles.page}>
        {watermark ? <WatermarkBlock block={watermark} {...common} /> : null}
        {letterhead ? <LetterheadBlock block={letterhead} {...common} /> : null}
        {flow.map(flowNode)}
        {footer ? <FooterBandBlock block={footer} {...common} /> : null}
        {/* Overlays last, so a seal sits over the text it stamps. */}
        {pageStamps.map((b) => (
          <PageStamp
            key={b.id}
            block={b}
            theme={template.theme}
            asset={assets[b.props.assetId]}
          />
        ))}
      </Page>
    </Document>
  );
}
