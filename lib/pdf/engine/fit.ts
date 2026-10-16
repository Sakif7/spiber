import type { Block, TemplateDoc } from "@/lib/schemas/pdf-template";

/**
 * Fitting a document onto as few pages as it needs.
 *
 * Every document carries a fixed part — letterhead, header, bank details,
 * terms, the signature — that already fills most of an A4 sheet, so a table
 * of four or five lines used to push the closing parts onto a second page:
 * the signature alone, or the terms and the signature, under a page of
 * white space. The owner's rules: a small document always prints on ONE
 * page; no document takes a page it does not need — a 36-line proposal that
 * spilled one row and the terms onto a third page while page two had room
 * was the second report; and only a table too long for its pages continues,
 * the next page then opening with table rows, never with only the closing
 * parts.
 *
 * So a document is laid out at the template's own spacing first, and when
 * that runs onto more than one page it is laid out again, tighter
 * (`renderFitted` in `lib/pdf/render.ts` decides, from how the pages
 * actually came out — never from an estimate):
 *
 *   0  the template as designed;
 *   1  half the space between blocks, tighter table rows and sign-off;
 *   2  level 1, the text half a point smaller;
 *   3  level 1, the text a point smaller — the floor.
 *
 * The fewest pages any level reaches wins, with the least tightening that
 * reaches it; a document no level shortens keeps its designed layout. The
 * stationery (letterhead, footer band, watermark) and the room left above a
 * signature line for a real pen are the same at every level.
 *
 * When the chosen layout still ends on a page with no table rows — only the
 * terms and the signature — everything after the last table travels with
 * the table's closing rows instead (`tailWithTable`), so that page opens
 * with rows.
 */

export type FitLevel = 0 | 1 | 2 | 3;

/** How the laid-out document came out, for the fitting loop. */
export type Paginated = {
  pages: number;
  /**
   * The height a continuation page has for flow — from under the letterhead
   * to the bottom margin. Null on a one-page document.
   */
  flowArea: number | null;
  /**
   * On a `measure` layout: the natural height of the table's closing rows
   * with the rest of the document attached. Null when nothing was attached.
   */
  tailHeight: number | null;
  /** The document has a table the closing parts could travel with. */
  hasTable: boolean;
  /** The last page carries rows of a table, not only the closing parts. */
  lastPageHasRows: boolean;
};

export type PageFit = {
  level: FitLevel;
  /**
   * Keep everything after the last table with the table's closing rows, so
   * a page never opens with only the closing parts of the document.
   */
  tailWithTable?: boolean;
  /**
   * Lay the document out on one endless page, unbroken, so the piece
   * `tailWithTable` makes can be measured at its natural height before it
   * is trusted to a real page — react-pdf does not refuse a piece taller
   * than a page, it squeezes every row in it to fit.
   */
  measure?: boolean;
  /** Told how the document was laid out. */
  report?: (p: Paginated) => void;
};

/** The prop that marks the piece `tailWithTable` attaches the tail to. */
export const TAIL_MARK = "data-fit-tail";

/** The prop that marks a table's box — every piece of it, on every page. */
export const TABLE_MARK = "data-fit-table";

/** Space between blocks, as a share of the template's own. */
const GAP_SCALE = 0.5;

/** How far the text steps down at each level. */
const FONT_DOWN: Record<FitLevel, number> = { 0: 0, 1: 0, 2: 0.5, 3: 1 };

const scaled = (n: number) => Math.round(n * GAP_SCALE * 100) / 100;

function tightenBlock(b: Block, down: number): Block {
  const style = b.style
    ? {
        ...b.style,
        ...(b.style.marginTop != null
          ? { marginTop: scaled(b.style.marginTop) }
          : {}),
        ...(b.style.marginBottom != null
          ? { marginBottom: scaled(b.style.marginBottom) }
          : {}),
        ...(b.style.fontSize != null
          ? { fontSize: b.style.fontSize - down }
          : {}),
      }
    : b.style;
  switch (b.type) {
    case "bullets":
      return {
        ...b,
        style,
        props: { ...b.props, headingGap: scaled(b.props.headingGap) },
      };
    case "keyValueList":
      return {
        ...b,
        style,
        props: { ...b.props, headingGap: scaled(b.props.headingGap) },
      };
    case "labelledList":
      return {
        ...b,
        style,
        props: { ...b.props, headingGap: scaled(b.props.headingGap) },
      };
    case "metaColumns":
      return {
        ...b,
        style,
        props: { ...b.props, lineGap: scaled(b.props.lineGap) },
      };
    case "spacer":
      return {
        ...b,
        style,
        props: { ...b.props, height: scaled(b.props.height) },
      };
    default:
      return { ...b, style } as Block;
  }
}

/**
 * The template as laid out at `level`: block spacing scaled, the text
 * stepped down. Level 0 is the template itself, untouched — a document that
 * fits as designed prints exactly as it always did.
 */
export function fitTemplate(t: TemplateDoc, level: FitLevel): TemplateDoc {
  if (level === 0) return t;
  const down = FONT_DOWN[level];
  return {
    ...t,
    theme: {
      ...t.theme,
      font: {
        ...t.theme.font,
        size: t.theme.font.size - down,
        tableSize: t.theme.font.tableSize - down,
      },
    },
    blocks: t.blocks.map((b) => tightenBlock(b, down)),
  };
}

/** Block types that are tables, which a long document's tail travels with. */
export const TABLE_BLOCK_TYPES: ReadonlySet<Block["type"]> = new Set<
  Block["type"]
>(["lineTable", "equipmentTable", "keyValueTable"]);

/**
 * How a laid-out document came out, read from react-pdf's layout tree.
 *
 * A page's own box is the sheet; its direct children's boxes are measured
 * from the sheet's top, nested ones from their parent's. The flow area is
 * read off a continuation page — the first piece of flow there starts just
 * under the letterhead — and the tail's height off the marked piece. A
 * table split across pages leaves a copy of its box on each, carrying its
 * mark; a page "has rows" when such a piece holds anything besides the
 * repeated (fixed) head.
 */
export function paginationOf(layout: unknown): Paginated {
  type Node = {
    props?: Record<string, unknown>;
    style?: { height?: number; paddingBottom?: number };
    box?: { top: number; height: number; paddingBottom?: number };
    children?: Node[];
  };
  const pages = ((layout as Node | null)?.children ?? []) as Node[];
  const isFixed = (n: Node) =>
    Boolean(n.props && "fixed" in n.props && n.props.fixed);

  let flowArea: number | null = null;
  const second = pages[1];
  if (second) {
    const height = second.box?.height ?? second.style?.height ?? 0;
    const padBottom =
      second.box?.paddingBottom ?? second.style?.paddingBottom ?? 0;
    const first = (second.children ?? []).find(
      (c) => !isFixed(c) && c.box && Number.isFinite(c.box.top),
    );
    if (first?.box) flowArea = height - padBottom - first.box.top;
  }

  let tailHeight: number | null = null;
  let hasTable = false;
  const rowsIn = (n: Node): boolean => {
    let found = false;
    if (n.props?.[TABLE_MARK]) {
      hasTable = true;
      if ((n.children ?? []).some((c) => !isFixed(c))) found = true;
    }
    if (n.props?.[TAIL_MARK] && n.box) tailHeight = n.box.height;
    for (const c of n.children ?? []) if (rowsIn(c)) found = true;
    return found;
  };
  let lastPageHasRows = false;
  pages.forEach((page, i) => {
    const rows = rowsIn(page);
    if (i === pages.length - 1) lastPageHasRows = rows;
  });

  return {
    pages: pages.length,
    flowArea,
    tailHeight,
    hasTable,
    lastPageHasRows,
  };
}
