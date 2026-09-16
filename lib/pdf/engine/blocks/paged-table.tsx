import React from "react";
import { View } from "@react-pdf/renderer";

/**
 * A ruled table that breaks across pages the way a typeset one does.
 *
 * react-pdf splits a wrapping view wherever the page ends — through the
 * middle of a row, leaving its top half on one page and its border on the
 * next — and the only knob it offers is `wrap={false}` on the whole block,
 * which is a page of white space above a table that would have fitted with
 * three rows moved. The rules a reader expects, enforced here for every
 * table block:
 *
 * - a row is never sliced: one that does not fit moves whole to the next
 *   page (`wrap={false}` on every row);
 * - the head repeats on every continuation page;
 * - a table never opens with a lone head, or a head and one row, at the
 *   foot of a page: the first rows are one unbreakable piece
 *   (`OPENING_ROWS`), and a head left behind when they move hides itself;
 * - the tail (totals) never opens a page on its own: it travels with the
 *   last item row.
 *
 * How the head is done, because react-pdf's paginator is particular:
 *
 * The head is a `fixed` view, which the paginator copies into every piece a
 * split table leaves — that is what makes it repeat. It carries the head as
 * plain children AND as a `render` prop. The children give it its height
 * from the first layout on, and the render prop only ever *removes* the
 * head, never adds it: when the paginator resolves render props it re-lays
 * the page out at the height it measured before they ran, so a head that
 * *appeared* on a continuation page would be paid for by squeezing every
 * other block on that page (`flexShrink` cannot be turned off — react-pdf
 * reads `0` as unset). A head that disappears costs nothing.
 *
 * The one page where the head must go is the piece the opening rows left
 * behind: the opening is unbreakable, so when it does not fit the table's
 * first piece is the head alone. The opening records the page it rendered
 * on; the head compares. react-pdf calls render props in page order, first
 * while deciding the breaks and again once the pages are final, so on that
 * final pass the head on the abandoned page sees the opening's real page
 * ahead of it and renders nothing. While the breaks were being decided the
 * abandoned head was still there, costing that page at most a head's
 * height of room that nothing else could have used anyway (the table did
 * not fit).
 *
 * Rows carry the frame (see `theme.ts`): react-pdf stretches the first
 * piece of a split view to the page edge, so a border on the table box
 * would run on below the last row.
 */

/** Rows the table must open with, on top of the head. */
const OPENING_ROWS = 2;

/** A row: a `View` element, so it can take `wrap`. */
type Row = React.ReactElement<React.ComponentProps<typeof View>>;

type Props = {
  /** The head row, already styled; a table without one repeats nothing. */
  head: Row | null;
  /** The item rows, keyed. */
  rows: Row[];
  /** Totals and the like, keyed; kept with the last item row. */
  tail?: Row[];
  /** The block's own margins and such. */
  style?: Record<string, string | number>;
  /** The block's "keep on one page": no split at all. */
  keepTogether?: boolean;
  /** The block's `minPresenceAhead`. */
  minPresenceAhead?: number;
};

const solid = (row: Row) => React.cloneElement(row, { wrap: false });

type PageProps = { pageNumber: number };

/**
 * The two render props, sharing the page the opening rows landed on — see
 * above. Built outside the component: this module is imported by server
 * routes, where Next refuses React hooks, and a ref is not needed for two
 * closures over one variable.
 */
function pageTracking(head: Row, opening: Row[]) {
  let landed = 0;
  return {
    head: ({ pageNumber }: PageProps) => (pageNumber >= landed ? head : null),
    opening: ({ pageNumber }: PageProps) => {
      landed = pageNumber;
      return opening;
    },
  };
}

export function PagedTable({
  head,
  rows,
  tail = [],
  style,
  keepTogether,
  minPresenceAhead,
}: Props) {
  // Small enough to be one piece: nothing to repeat, nothing to split.
  if (keepTogether || rows.length <= OPENING_ROWS + 1) {
    return (
      <View style={style} wrap={false} minPresenceAhead={minPresenceAhead}>
        {head}
        {rows}
        {tail}
      </View>
    );
  }

  const opening = rows.slice(0, OPENING_ROWS);
  const middle = rows.slice(OPENING_ROWS, -1).map(solid);
  const closing = rows.slice(-1);
  const track = head ? pageTracking(head, opening) : null;

  return (
    <View style={style} minPresenceAhead={minPresenceAhead}>
      {track ? (
        <View fixed render={track.head}>
          {head}
        </View>
      ) : null}
      <View wrap={false} render={track?.opening}>
        {opening}
      </View>
      {middle}
      <View wrap={false}>
        {closing}
        {tail}
      </View>
    </View>
  );
}
