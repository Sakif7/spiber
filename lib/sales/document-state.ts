/**
 * Does a generated document still say what the order says?
 *
 * Proposals and invoices are stored as immutable snapshots on purpose — the
 * client holds a printed copy, and it has to stay reproducible after the order
 * is amended. The cost of that is a document which quietly stops matching the
 * order the moment a price or a quantity is renegotiated, with nothing on
 * screen to say so. Whoever opens it then reads figures that are no longer
 * true, and has no way to tell.
 *
 * So the comparison is made explicit, and the admin is told.
 *
 * Pure and framework-free: the server page decides what to render, and the
 * rule itself is unit-tested rather than eyeballed.
 */

/** The parts of a line a reader would notice changing. */
export type ComparableLine = {
  description: string;
  unitPriceMinor: number;
  qty: number;
};

export type ComparableSnapshot = {
  items: ComparableLine[];
  totalMinor: number;
  /**
   * How the quantities were printed.
   *
   * A proposal is normally quoted per piece: every line prints a quantity of
   * one whatever the order says, because the client is agreeing a rate and
   * decides the quantity later. Comparing quantities against such a document
   * would call it stale the moment it was made.
   */
  quantityMode?: "single" | "ordered" | null;
};

export function documentMatchesOrder(
  snapshot: ComparableSnapshot,
  order: ComparableSnapshot,
): boolean {
  if (snapshot.items.length !== order.items.length) return false;

  for (const [i, snapLine] of snapshot.items.entries()) {
    const live = order.items[i];
    if (!live) return false;
    if (snapLine.description !== live.description) return false;
    // The rate is the thing that gets renegotiated, and it is on the paper
    // whichever way the quantities were printed.
    if (snapLine.unitPriceMinor !== live.unitPriceMinor) return false;
    if (snapLine.qty !== live.qty) return false;
  }

  // A per-piece quotation never showed the order's total, so there is nothing
  // to compare it against. Everything else did, and the total is what catches
  // a changed discount, VAT or transport charge — none of which shows on any
  // single line.
  if (snapshot.quantityMode === "single") return true;
  return snapshot.totalMinor === order.totalMinor;
}
