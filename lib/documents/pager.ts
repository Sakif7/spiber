/**
 * Live pagination shared by the editor and the printer.
 *
 * The text lives in ONE tall column laid over a stack of A4 pages. The pager
 * measures each top-level block and, whenever a block would cross the
 * bottom of a page's text area, pushes it down to the top of the next page.
 * A paragraph therefore never splits across pages (the same rule the print
 * CSS applies), a hard page break pushes the next block, and the result —
 * how many pages, which page each block starts on — drives the page chrome
 * (letterhead, footer, page numbers) on screen and on paper.
 *
 * The pushes are applied as a stylesheet (`nth-child` rules), never as
 * attributes on the blocks: ProseMirror owns those nodes and would treat an
 * attribute change as an edit to reconcile.
 *
 * `paginate` must be called with NO pushes applied — the caller blanks its
 * stylesheet first — so the result is a function of the content alone. An
 * earlier version measured with the previous pushes in place and subtracted
 * them out; any drift between the two (collapsed margins, whole-pixel
 * rounding) then flipped a block near a page edge back and forth every
 * frame. Measuring clean makes that feedback loop impossible.
 *
 * `paginate` is deliberately self-contained (no imports, no closures over
 * module scope): the printer injects `paginate.toString()` into the page it
 * renders in Chromium, so the very same code paginates both.
 */
export type PageMetrics = {
  /** Full page height in CSS px (A4: 1123). */
  pageHeight: number;
  /** Distance from the page top to the first line of text. */
  contentTop: number;
  /** Distance from the last line of text to the page bottom. */
  contentBottom: number;
  /** Gap drawn between pages (screen only). */
  gap: number;
};

export type PageResult = {
  pages: number;
  /** For every top-level block, the 1-based page it starts on. */
  pageOfBlock: number[];
  /** The stylesheet that pushes blocks to page tops via `selector > :nth-child(n)`. */
  css: string;
};

export function paginate(
  column: HTMLElement,
  m: PageMetrics,
  selector: string,
): PageResult {
  const blocks: HTMLElement[] = [];
  for (let i = 0; i < column.children.length; i++) {
    const el = column.children[i] as HTMLElement;
    if (el.nodeType === 1) blocks.push(el);
  }
  const contentHeight = m.pageHeight - m.contentTop - m.contentBottom;
  const stride = m.pageHeight + m.gap;

  // Read everything first (no layout thrash). Client rects keep sub-pixel
  // positions (offsetTop rounds to whole pixels); the editor scales the
  // pages for zoom, so rects are divided back into layout pixels.
  const colRect = column.getBoundingClientRect();
  const scale =
    column.offsetWidth > 0 ? colRect.width / column.offsetWidth || 1 : 1;
  type Box = {
    /** Top of the block including its own top margin. */
    top: number;
    /** Margin box height. */
    height: number;
    /** Border box height; 0 means margins collapse straight through it. */
    solid: number;
    marginTop: number;
    brk: boolean;
  };
  const boxes: Box[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const el = blocks[i];
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const marginTop = parseFloat(cs.marginTop) || 0;
    const marginBottom = parseFloat(cs.marginBottom) || 0;
    boxes.push({
      top: (r.top - colRect.top) / scale - marginTop,
      height: marginTop + r.height / scale + marginBottom,
      solid: r.height / scale,
      marginTop,
      brk: el.hasAttribute("data-page-break"),
    });
  }

  const pageOfBlock: number[] = [];
  const pushes: number[] = [];
  let offset = 0;
  let page = 0;
  let forceNext = false;
  // Border-bottom of the last block with any height, where things are now.
  let solidBottom = 0;
  for (let i = 0; i < blocks.length; i++) {
    const b = boxes[i];
    let top = b.top + offset;
    let pageStart = page * stride;
    let pageEnd = pageStart + contentHeight;
    let push = 0;
    const startsPage = Math.abs(top - pageStart) < 0.5;
    const overflows = top + b.height > pageEnd + 0.5;
    if ((forceNext || (overflows && !startsPage)) && i > 0) {
      page += 1;
      pageStart = page * stride;
      pageEnd = pageStart + contentHeight;
      // Adjoining margins collapse into their largest, and they fall
      // straight through empty blocks (a page break is one). The pushed
      // margin wins that collapse, so it is measured from the border-bottom
      // of the last block that has height — that puts this block's own top
      // margin exactly at the page top.
      push = pageStart - solidBottom;
      // Everything below moves by the distance this block travelled.
      offset += pageStart - top;
      top = pageStart;
    }
    // A block taller than a page runs on: it starts here, and the cursor
    // moves past its end so the next block lands on the page after it.
    pageOfBlock.push(page + 1);
    const bottom = top + b.height;
    while (bottom > pageEnd + 0.5 && b.height > contentHeight) {
      page += 1;
      pageEnd = page * stride + contentHeight;
    }
    if (b.solid > 0) solidBottom = top + b.marginTop + b.solid;
    pushes.push(push);
    forceNext = b.brk;
  }

  let css = "";
  for (let i = 0; i < blocks.length; i++) {
    if (pushes[i] > 0) {
      css += `${selector} > :nth-child(${i + 1}){margin-top:${(boxes[i].marginTop + pushes[i]).toFixed(2)}px !important}\n`;
    }
  }
  return { pages: Math.max(1, page + 1), pageOfBlock, css };
}

/** The pager as source text, for the print page. */
export function pagerSource(): string {
  return `window.__paginate = ${paginate.toString()};`;
}
