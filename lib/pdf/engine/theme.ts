import { StyleSheet } from "@react-pdf/renderer";
import type { Theme } from "@/lib/schemas/pdf-template";

/**
 * The stylesheet every block draws with, derived from a template's theme.
 *
 * This is the old hand-written sheet with its constants replaced by theme
 * values; the default theme produces byte-for-byte the same styles. Memoised
 * per theme so a document with sixty rows builds it once.
 */

export type Fonts = { regular: string; bold: string };

export function fontsFor(theme: Theme): Fonts {
  return theme.font.body === "Helvetica"
    ? { regular: "Helvetica", bold: "Helvetica-Bold" }
    : { regular: "Times-Roman", bold: "Times-Bold" };
}

function build(theme: Theme) {
  const { accent, ink, muted, rule, hairline, tint } = theme.colors;
  const { padX, padTop, padBottom } = theme.page;
  const font = fontsFor(theme);
  const size = theme.font.size;
  const tableSize = theme.font.tableSize;

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
      marginTop: 12,
      marginBottom: 10,
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
      marginBottom: 3,
    },

    /* ── bulleted terms ── */
    bulletRow: { flexDirection: "row", marginBottom: 1.5 },
    bulletDot: { width: 14, textAlign: "center" },
    bulletText: { flex: 1, textAlign: "justify" },

    /* ── table ──
       Ruled like the samples, but the weight is graded rather than uniform: a
       hairline between cells, a full rule around the table and under the head.
       A page of identical 1pt boxes is what made the old one read as a grid
       first and a table second. */
    table: { borderWidth: 1, borderColor: rule },
    tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: hairline },
    /** Under the head: a full rule, so the columns start clearly. */
    trHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: rule },
    trLast: { flexDirection: "row" },
    /** The first totals row: separated from the items by a full rule. */
    trTotalsStart: {
      flexDirection: "row",
      borderTopWidth: 1,
      borderBottomWidth: 0.5,
      borderColor: rule,
    },
    th: {
      fontFamily: font.bold,
      fontSize: tableSize,
      paddingVertical: 5,
      paddingHorizontal: 5,
      textAlign: "center",
      backgroundColor: tint,
      borderRightWidth: 0.5,
      borderColor: hairline,
    },
    td: {
      fontSize: tableSize,
      paddingVertical: 4.5,
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
    signRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    signBox: { width: 215 },
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
      paddingTop: 4,
    },
    /** "Approved By" / "Received By", centred on the rule above it. */
    signLabel: { width: 107, textAlign: "center" },
  });
}

export type Styles = ReturnType<typeof build>;

const cache = new Map<string, Styles>();

export function makeStyles(theme: Theme): Styles {
  const key = JSON.stringify(theme);
  let s = cache.get(key);
  if (!s) {
    // A handful of themes ever exist; don't let a fuzzed preview grow this.
    if (cache.size > 32) cache.clear();
    s = build(theme);
    cache.set(key, s);
  }
  return s;
}
