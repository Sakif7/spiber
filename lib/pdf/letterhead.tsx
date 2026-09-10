/* eslint-disable jsx-a11y/alt-text -- these are @react-pdf/renderer <Image> elements, not HTML images */
import fs from "node:fs";
import path from "node:path";
import React from "react";
import {
  Text,
  View,
  Image,
  StyleSheet,
  Svg,
  Path,
  Circle,
  G,
  Font,
} from "@react-pdf/renderer";
import { LEGAL, CONTACT, OFFICES } from "@/lib/contact";

/**
 * The company letterhead, shared by every generated document.
 *
 * Reproduces the printed stationery the client sent as samples: the teal bar
 * down the left edge, the wordmark, a contact column with circular icon badges
 * listing both offices, the two-tone rule beneath, and the "empowering
 * healthcare" band across the foot of the page.
 *
 * Marked `fixed`, so it repeats on every page: this is stationery, and a
 * second page of a proposal on blank paper is not the company's letterhead.
 * The footer band and the watermark already worked this way.
 *
 * Deliberately NOT reproduced: the round company seal and the handwritten
 * signature that appear on the scans. A generated document carries the
 * signature LINE and the name; the seal and signature go on by hand, which is
 * the point of them.
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
 * renderer to wrap between words instead.
 */
Font.registerHyphenationCallback((word) => [word]);

/** Sampled from the logo artwork so drawn bars match the wordmark exactly. */
const TEAL = "#20b0b0";
const INK = "#1a1a1a";
const MUTED = "#444444";
const RULE = "#000000";
/** Between cells: present, but not competing with the numbers. */
const HAIRLINE = "#9a9a9a";
/** Table header wash — the faintest teal that still separates the head row. */
const TINT = "#eaf7f7";

/** Page geometry, in points. A4 is 595 wide. */
const PAGE_PAD_X = 40;
const PAGE_PAD_TOP = 26;

export const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_PAD_TOP,
    // Room for the footer band, and no more: a short proposal has to fit on
    // one page the way the printed stationery does.
    paddingBottom: 52,
    paddingHorizontal: PAGE_PAD_X,
    fontFamily: "Times-Roman",
    fontSize: 10.5,
    color: INK,
  },

  /* ── letterhead ── */
  head: { position: "relative", flexDirection: "row" },
  edgeBar: {
    position: "absolute",
    left: -PAGE_PAD_X,
    top: -PAGE_PAD_TOP,
    width: 22,
    height: 118,
    backgroundColor: TEAL,
  },
  logoWrap: { justifyContent: "center", paddingTop: 6 },
  logo: { width: 190 },
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
    color: INK,
    lineHeight: 1.35,
  },
  contactLabel: { fontFamily: "Helvetica-Bold", fontSize: 7.5, color: INK },

  /* the rule under the letterhead: thick on the left, hairline to the edge */
  ruleRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 6 },
  ruleThick: {
    marginLeft: -PAGE_PAD_X,
    width: 250,
    height: 7,
    backgroundColor: TEAL,
  },
  ruleThin: {
    flexGrow: 1,
    marginRight: -PAGE_PAD_X,
    height: 2,
    backgroundColor: TEAL,
  },

  /* ── body ── */
  title: {
    fontFamily: "Times-Bold",
    fontSize: 12.5,
    textAlign: "center",
    textDecoration: "underline",
    marginTop: 12,
    marginBottom: 10,
  },
  label: { fontFamily: "Times-Bold" },
  underlineLabel: { fontFamily: "Times-Bold", textDecoration: "underline" },
  small: { fontSize: 10 },
  muted: { color: MUTED },
  section: { marginBottom: 10 },

  /* ── the templates' two-column header: our reference | the client ── */
  partyRow: { flexDirection: "row", gap: 24, marginTop: 8 },
  partyCol: { flex: 1 },
  partyHeading: {
    fontFamily: "Times-Bold",
    textDecoration: "underline",
    marginBottom: 3,
  },
  metaLine: { marginBottom: 1 },

  /* ── bulleted terms ── */
  bulletRow: { flexDirection: "row", marginBottom: 1.5 },
  bulletDot: { width: 14, textAlign: "center" },
  bulletText: { flex: 1, textAlign: "justify" },

  /* ── table ──
     Ruled like the samples, but the weight is graded rather than uniform: a
     hairline between cells, a full rule around the table and under the head.
     A page of identical 1pt boxes is what made the old one read as a grid
     first and a table second. */
  table: { borderWidth: 1, borderColor: RULE },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: HAIRLINE },
  /** Under the head: a full rule, so the columns start clearly. */
  trHead: { flexDirection: "row", borderBottomWidth: 1, borderColor: RULE },
  trLast: { flexDirection: "row" },
  /** The first totals row: separated from the items by a full rule. */
  trTotalsStart: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 0.5,
    borderColor: RULE,
  },
  th: {
    fontFamily: "Times-Bold",
    fontSize: 9.5,
    paddingVertical: 5,
    paddingHorizontal: 5,
    textAlign: "center",
    backgroundColor: TINT,
    borderRightWidth: 0.5,
    borderColor: HAIRLINE,
  },
  td: {
    fontSize: 9.5,
    paddingVertical: 4.5,
    paddingHorizontal: 5,
    textAlign: "center",
    borderRightWidth: 0.5,
    borderColor: HAIRLINE,
  },
  /** The empty run to the left of the totals: one cell, not four boxes. */
  tdSpan: { borderRightWidth: 0.5, borderColor: HAIRLINE },
  /** The figure a reader is looking for. */
  tdStrong: { fontFamily: "Times-Bold", backgroundColor: TINT },
  /** Item description: reads far better ranged left than centred. */
  tdText: { textAlign: "left" },
  /** Money: ranged right so the columns of figures align. */
  tdNum: { textAlign: "right" },

  /* ── decoration ── */
  watermark: {
    position: "absolute",
    top: -PAGE_PAD_TOP,
    left: -PAGE_PAD_X,
    width: 595,
    height: 842,
  },

  /* ── footer band ── */
  footerBand: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: TEAL,
    paddingVertical: 7,
  },
  footerText: {
    color: "#ffffff",
    fontSize: 9,
    textAlign: "center",
    fontFamily: "Helvetica",
    letterSpacing: 3,
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
    borderColor: RULE,
    paddingTop: 4,
  },
  /** "Approved By" / "Received By", centred on the rule above it. */
  signLabel: { width: 107, textAlign: "center" },
});

/**
 * Read a bundled image once; a missing file must not break the document.
 *
 * react-pdf embeds whatever bytes it is given, so the 1024px site logo made
 * every generated PDF about 1.8 MB — for an image drawn 190pt wide, in a
 * document that gets emailed. Regenerate with `npm run make-pdf-assets`.
 */
const imageCache = new Map<string, Buffer | null>();
function publicImage(name: string): Buffer | null {
  if (imageCache.has(name)) return imageCache.get(name)!;
  for (const candidate of [path.join("pdf", name), name]) {
    try {
      const buf = fs.readFileSync(
        path.join(process.cwd(), "public", candidate),
      );
      imageCache.set(name, buf);
      return buf;
    } catch {
      // try the next candidate
    }
  }
  imageCache.set(name, null);
  return null;
}

/**
 * One circular badge from the letterhead's contact column.
 *
 * The glyphs are drawn stroked inside a scaled group rather than as one
 * hand-written path: the previous phone and office marks relied on an implicit
 * lineto after a moveto ("M4 11.2 12 4l…"), which this renderer resolves
 * differently from a browser — the office mark came out as an arch and the
 * phone as a blob. Every command below is explicit, and every shape is one the
 * renderer draws the same way at any size.
 */
const GLYPHS: Record<string, string[]> = {
  phone: [
    "M7 3 L11 3 L12.5 8 L10 9.5 C11 12 12 13 14.5 14 L16 11.5 L21 13 L21 17 C21 19 19.5 20.5 17.5 20.3 C10 19.5 4.5 14 3.7 6.5 C3.5 4.5 5 3 7 3 Z",
  ],
  mail: ["M3 6 L21 6 L21 18 L3 18 Z", "M3 6 L12 13 L21 6"],
  web: [
    "M12 3 C16.9 3 21 7.1 21 12 C21 16.9 16.9 21 12 21 C7.1 21 3 16.9 3 12 C3 7.1 7.1 3 12 3 Z",
    "M3 12 L21 12",
    "M12 3 C15 6.5 15 17.5 12 21 C9 17.5 9 6.5 12 3 Z",
  ],
  place: [
    "M12 2.5 C16 2.5 19 5.5 19 9.5 C19 14.5 12 21.5 12 21.5 C12 21.5 5 14.5 5 9.5 C5 5.5 8 2.5 12 2.5 Z",
    "M12 7 C13.4 7 14.5 8.1 14.5 9.5 C14.5 10.9 13.4 12 12 12 C10.6 12 9.5 10.9 9.5 9.5 C9.5 8.1 10.6 7 12 7 Z",
  ],
};

function ContactIcon({ kind }: { kind: "phone" | "mail" | "web" | "place" }) {
  return (
    <Svg viewBox="0 0 24 24" style={{ width: 12, height: 12 }}>
      <Circle
        cx="12"
        cy="12"
        r="11"
        fill="#ffffff"
        stroke={TEAL}
        strokeWidth={1.6}
      />
      {/* The 24-unit glyph, brought down to sit inside the ring. */}
      <G transform="translate(5.4 5.4) scale(0.55)">
        {GLYPHS[kind].map((d, i) => (
          <Path
            key={i}
            d={d}
            stroke={TEAL}
            strokeWidth={2}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
      </G>
    </Svg>
  );
}

function ContactLine({
  kind,
  children,
}: {
  kind: "phone" | "mail" | "web" | "place";
  children: React.ReactNode;
}) {
  return (
    <View style={styles.contactRow}>
      <View style={styles.contactIcon}>
        <ContactIcon kind={kind} />
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export function Letterhead() {
  const logo = publicImage("letterhead-logo.png");
  const head = OFFICES[0];
  const regional = OFFICES[1];

  return (
    <View fixed>
      <View style={styles.head}>
        <View style={styles.edgeBar} />
        <View style={styles.logoWrap}>
          {logo ? (
            <Image style={styles.logo} src={{ data: logo, format: "png" }} />
          ) : (
            <Text style={{ fontFamily: "Times-Bold", fontSize: 18 }}>
              {LEGAL.name}
            </Text>
          )}
        </View>

        <View style={styles.contact}>
          <ContactLine kind="phone">
            <Text style={styles.contactText}>{CONTACT.phone}</Text>
          </ContactLine>
          <ContactLine kind="mail">
            <Text style={styles.contactText}>{CONTACT.generalEmail}</Text>
          </ContactLine>
          <ContactLine kind="web">
            <Text style={styles.contactText}>www.spibermed.com</Text>
          </ContactLine>
          {head ? (
            <ContactLine kind="place">
              <Text style={styles.contactLabel}>Head Office:</Text>
              <Text style={styles.contactText}>{head.address.en}</Text>
            </ContactLine>
          ) : null}
          {regional ? (
            <ContactLine kind="place">
              <Text style={styles.contactLabel}>Regional Office:</Text>
              <Text style={styles.contactText}>{regional.address.en}</Text>
            </ContactLine>
          ) : null}
        </View>
      </View>

      <View style={styles.ruleRow}>
        <View style={styles.ruleThick} />
        <View style={styles.ruleThin} />
      </View>
    </View>
  );
}

/**
 * The pale dot motif the printed stationery carries down the right of the page.
 *
 * The logo's own dot cluster, cut down its middle and only the LEFT half
 * kept — the client marked that cut on the artwork. Blown up and dropped to a
 * wash so it sits behind the text, with the cut edge running off the right of
 * the page so the pattern reads as continuing past it.
 *
 * Rendered as the first child of a Page so everything else paints over it, and
 * `fixed` so it repeats on a second page. Coordinates are in points against
 * the full A4 box, which is why the view is pulled out to the page edges by
 * the padding.
 */
/**
 * Measured off `letterhead-logo.png` and normalised so the motif can be drawn
 * at any size: x runs from the outer edge toward the cut, y from the top of
 * the cluster, and r is a fraction of the half's width. Kept as circles rather than an upscaled
 * crop, which at this size would be visibly soft.
 */
const WATERMARK_DOTS: { x: number; y: number; r: number }[] = [
  { x: 0.6705, y: 0.0696, r: 0.1676 },
  { x: 0.1371, y: 0.2911, r: 0.1371 },
  { x: 0.6705, y: 0.5032, r: 0.1714 },
  { x: 0.1524, y: 0.712, r: 0.141 },
  { x: 0.6705, y: 0.9304, r: 0.1676 },
];
/** Height of that half, as a multiple of its width. */
const WATERMARK_ASPECT = 2.4076;

/** Printed size and placement: the cut edge sits past the right page edge,
 *  so what shows is the half the client marked. */
const WM_WIDTH = 210;
const WM_BLEED = 26;

export function Watermark() {
  const w = WM_WIDTH;
  const h = w * WATERMARK_ASPECT;
  const x0 = 595 + WM_BLEED - w;
  const y0 = (842 - h) / 2;

  return (
    <View style={styles.watermark} fixed>
      <Svg viewBox="0 0 595 842" style={{ width: 595, height: 842 }}>
        {WATERMARK_DOTS.map((d, i) => (
          <Circle
            key={i}
            cx={String(x0 + d.x * w)}
            cy={String(y0 + d.y * h)}
            r={String(d.r * w)}
            fill={TEAL}
            fillOpacity={0.09}
          />
        ))}
      </Svg>
    </View>
  );
}

export function FooterBand() {
  return (
    <View style={styles.footerBand} fixed>
      <Text style={styles.footerText}>empowering healthcare</Text>
    </View>
  );
}

/**
 * The closing signature row.
 *
 * The templates label the left line "Approved By" and, on an invoice, add
 * "Received By" on the right. The signatory's name and role sit under the
 * left line, as they do on the documents the company actually sent — a bare
 * "Approved By" tells the reader nothing about who approved it.
 *
 * Space is left above each line for a real pen. No signature image and no seal
 * is ever drawn: those are what make the paper copy the original.
 */
export function SignOffRow({
  left,
  right,
  signatory,
}: {
  left: string;
  right?: string;
  signatory?: { name: string; title: string; phone?: string; email?: string };
}) {
  return (
    <View style={styles.signRow} wrap={false}>
      <View style={styles.signBox}>
        <View style={{ height: 26 }} />
        <View style={styles.signLine}>
          <Text style={[styles.small, styles.label, styles.signLabel]}>
            {left}
          </Text>
        </View>
        {signatory ? (
          /* Ranged left under the rule: a centred address block reads as a
             title page, and the client asked for the name to stay put. */
          <View style={{ paddingTop: 2 }}>
            <Text style={styles.small}>{signatory.name}</Text>
            {/* The designation carries the authority the signature claims,
                so it is the line set in bold. */}
            <Text style={[styles.small, styles.label]}>{signatory.title}</Text>
            <Text style={styles.small}>{LEGAL.name}</Text>
            {signatory.phone ? (
              <Text style={styles.small}>Contact: {signatory.phone}</Text>
            ) : null}
            {signatory.email ? (
              <Text style={styles.small}>E-mail: {signatory.email}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {right ? (
        <View style={styles.signBox}>
          <View style={{ height: 26 }} />
          <View style={styles.signLine}>
            <Text style={[styles.small, styles.label, styles.signLabel]}>
              {right}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
