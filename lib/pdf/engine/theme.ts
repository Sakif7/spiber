import { StyleSheet } from "@react-pdf/renderer";
import type { Theme } from "@/lib/schemas/pdf-template";

/**
 * The stylesheet every block draws with, derived from a template's theme.
 *
 * This is the old hand-written sheet with its constants replaced by theme
 * values; the default theme produces byte-for-byte the same styles. Memoised
 * per theme so a document with sixty rows builds it once.
 *
 * `tight` is the sheet a document is fitted onto one page with (`fit.ts`):
 * table rows, list rows, the sign-off row and the gaps under the letterhead
 * and the title lose some of their air. The room above a signature line for
 * a real pen, and the stationery itself, are the same either way.
 */

export type Fonts = { regular: string; bold: string };

export function fontsFor(theme: Theme): Fonts {
  return theme.font.body === "Helvetica"
    ? { regular: "Helvetica", bold: "Helvetica-Bold" }
    : { regular: "Times-Roman", bold: "Times-Bold" };
}

function build(theme: Theme, tight: boolean) {
  const { accent, ink, muted, rule, hairline, tint } = theme.colors;
  const { padX, padTop, padBottom } = theme.page;
  const font = fontsFor(theme);
  const size = theme.font.size;
  const tableSize = theme.font.tableSize;
  /** The spacing a constant takes when the document is being fitted. */
  const air = (normal: number, fitted: number) => (tight ? fitted : normal);

  return StyleSheet.create({
    page: {
      paddingTop: padTop,
      // Room for the footer band, and no more: a short proposal has to fit on
      // one page the way the printed stationery does.
      paddingBottom: padBottom,
      paddingHorizontal: padX,
      fontFamily: font.regular,
      fontSize: size,
      color: ink,
    },

    /* ── letterhead ── */
    head: { position: "relative", flexDirection: "row" },
    edgeBar: {
      position: "absolute",
      left: -padX,
      top: -padTop,
      width: 22,
      height: 118,
      backgroundColor: accent,
    },
    logoWrap: { justifyContent: "center", paddingTop: 6 },
    logo: { width: 190 },
    logoFallback: { fontFamily: font.bold, fontSize: 18 },
    /**
     * The contact column runs to the edge of the sheet, as on the printed
     * stationery. The width is set so the longest line — the regional office's
     * "Panchlaish, Chittagong-4211, Bangladesh" — fills it rather than stopping
     * short, and the negative margin carries the block out through the page
     * padding to sit a few points off the trim.
     */
    contact: { marginLeft: "auto", width: 158, marginRight: -32 },
    contactRow: { flexDirection: "row", marginBottom: 5 },
    contactIcon: { marginRight: 6, marginTop: 0.5 },
    contactText: {
      fontFamily: "Helvetica",
      fontSize: 7.5,
      color: ink,
      lineHeight: 1.35,
    },
    contactLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: ink },

    /* the rule under the letterhead: thick on the left, hairline to the edge */
    /* The gap between the rule and whatever follows lives here, not on the
       first body block: the letterhead repeats on every page, so a table or
       paragraph continuing on page 2 starts the same distance below the
       rule as the title does on page 1. */
    letterhead: { marginBottom: air(12, 6) },
    ruleRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
    ruleThick: {
      marginLeft: -padX,
      width: 250,
      height: 7,
      backgroundColor: accent,
    },
    ruleThin: {
      flexGrow: 1,
      marginRight: -padX,
      height: 2,
      backgroundColor: accent,
    },

    /* ── body ── */
    title: {
      fontFamily: font.bold,
      fontSize: size + 2,
      textAlign: "center",
      textDecoration: "underline",
      marginBottom: air(10, 5),
    },
    label: { fontFamily: font.bold },
    underlineLabel: { fontFamily: font.bold, textDecoration: "underline" },
    small: { fontSize: size - 0.5 },
    muted: { color: muted },
    section: { marginBottom: 10 },

    /* ── the templates' two-column header: our reference | the client ── */
    partyCol: { flex: 1 },
    partyHeading: {
      fontFamily: font.bold,
      textDecoration: "underline",
      marginBottom: air(3, 2),
    },

    /* ── the price offer's table ──
       Three rules and nothing else: the company's own offer paper draws no
       boxes and no vertical lines, so the rules live on the head and on the
       total row, and the rows in between carry none. As with the ruled
       table, the frame is on the rows rather than on the table box — a box
       is stretched to the page edge when a long list of accessories breaks
       across pages. */
    offerCaption: { flexDirection: "row", marginBottom: air(2, 1) },
    offerTable: {},
    offerHead: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: rule,
      paddingVertical: air(2.5, 1.5),
    },
    offerRow: { flexDirection: "row", paddingVertical: air(1, 0.5) },
    /** A deduction between the items and the total: a little air above it. */
    offerDeduct: { marginTop: air(3, 1.5) },
    /** The closing line: separated from the items by a full rule. */
    offerTotal: {
      borderTopWidth: 1,
      borderColor: rule,
      marginTop: air(2, 1),
      paddingTop: air(3, 2),
    },
    offerName: { flex: 1, paddingRight: 8 },
    /** The accessory's number, indented from the margin as the sample sets it. */
    offerNo: { width: 26, paddingLeft: 8 },
    /** A second line under an accessory's name — a size, a plate format. */
    offerSpec: { marginLeft: 26 },
    offerQty: { width: 84, textAlign: "center" },
    offerPrice: { width: 104, textAlign: "right" },

    /* ── numbered "Label : value" terms ── */
    termRow: { flexDirection: "row", marginBottom: air(1.5, 0.5) },
    termNo: { width: 22, textAlign: "right", paddingRight: 6 },
    termSep: { width: 14, textAlign: "center" },
    termText: { flex: 1, textAlign: "justify" },

    /* ── bulleted terms ── */
    bulletRow: { flexDirection: "row", marginBottom: air(1.5, 0.5) },
    /** One "Label: value" line of a label/value list — the bank details. */
    keyValueLine: { marginBottom: air(1, 0.5) },
    bulletDot: { width: 14, textAlign: "center" },
    bulletText: { flex: 1, textAlign: "justify" },

    /* ── table ──
       Ruled like the samples, but the weight is graded rather than uniform: a
       hairline between cells, a full rule around the table and under the head.
       A page of identical 1pt boxes is what made the old one read as a grid
       first and a table second.

       The frame is drawn by the rows, not by a box around them: the head
       carries the top rule, every row its two sides, the closing row
       (`trClose`) the bottom. A box would be stretched to the page edge when
       the table breaks across pages — its sides running on below the last
       row — and a row that moves whole to the next page must take its
       piece of the frame with it. */
    table: {},
    tr: {
      flexDirection: "row",
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 0.5,
      borderColor: rule,
      borderBottomColor: hairline,
    },
    /** Under the head: a full rule, so the columns start clearly. */
    trHead: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderColor: rule,
    },
    trLast: {
      flexDirection: "row",
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: rule,
    },
    /** The first totals row: separated from the items by a full rule. */
    trTotalsStart: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 0.5,
      borderColor: rule,
    },
    /** A totals line with nothing stacked beneath it: the rule above, no hairline below. */
    trTotalsOnly: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: rule,
    },
    /** Whatever row ends the table closes the frame with a full rule. */
    trClose: { borderBottomWidth: 1, borderBottomColor: rule },
    th: {
      fontFamily: font.bold,
      fontSize: tableSize,
      paddingVertical: air(5, 3),
      paddingHorizontal: 5,
      textAlign: "center",
      backgroundColor: tint,
      borderRightWidth: 0.5,
      borderColor: hairline,
    },
    td: {
      fontSize: tableSize,
      paddingVertical: air(4.5, 2.5),
      paddingHorizontal: 5,
      textAlign: "center",
      borderRightWidth: 0.5,
      borderColor: hairline,
    },
    /** The empty run to the left of the totals: one cell, not four boxes. */
    tdSpan: { borderRightWidth: 0.5, borderColor: hairline },
    /** The figure a reader is looking for. */
    tdStrong: { fontFamily: font.bold, backgroundColor: tint },
    /** Item description: reads far better ranged left than centred. */
    tdText: { textAlign: "left" },
    /** Money: ranged right so the columns of figures align. */
    tdNum: { textAlign: "right" },

    /* ── decoration ── */
    watermark: {
      position: "absolute",
      top: -padTop,
      left: -padX,
      width: 595,
      height: 842,
    },

    /* ── footer band ── */
    footerBand: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: accent,
      paddingVertical: 7,
    },
    footerText: {
      color: "#ffffff",
      fontSize: 9,
      textAlign: "center",
      fontFamily: "Helvetica",
    },

    /* ── signatures ── */
    /* Two equal columns with a little air above and below: the left block
       sits against the left margin, the right block against the right, each
       moving as one unit (rule, label and the name lines under it). The
       owner first asked for centred blocks, then corrected to the margins. */
    signRow: {
      flexDirection: "row",
      marginTop: air(10, 4),
      paddingVertical: air(8, 2),
    },
    signCol: { flex: 1, alignItems: "flex-start" },
    signColRight: { alignItems: "flex-end" },
    /** Hugs its content — the rule, or the widest name line beneath it. */
    signBox: {},
    /**
     * The ruled line, at half the box.
     *
     * A rule running the full 215pt read as a divider across the foot of the
     * page rather than as somewhere to sign; the client marked it to be cut
     * back. The name block below still uses the whole box, so a long line like
     * "SPIBER MED LIMITED" is not forced to wrap.
     */
    signLine: {
      width: 107,
      borderTopWidth: 1,
      borderColor: rule,
      paddingTop: air(4, 2),
    },
    /** "Approved By" / "Received By", centred on the rule above it. */
    signLabel: { width: 107, textAlign: "center" },
  });
}

export type Styles = ReturnType<typeof build>;

const cache = new Map<string, Styles>();

export function makeStyles(theme: Theme, tight = false): Styles {
  const key = `${tight ? "tight" : "as-designed"}:${JSON.stringify(theme)}`;
  let s = cache.get(key);
  if (!s) {
    // A handful of themes ever exist; don't let a fuzzed preview grow this.
    if (cache.size > 32) cache.clear();
    s = build(theme, tight);
    cache.set(key, s);
  }
  return s;
}
