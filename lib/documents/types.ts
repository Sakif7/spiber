/**
 * The written-document system's fixed facts: kinds, numbering, the A4 page
 * geometry the editor and the printer share, and the fonts that exist in
 * both. Nothing here touches the database, so the client may import it.
 */
export const DOCUMENT_TYPES = [
  "notice",
  "letter",
  "memo",
  "agreement",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  notice: "Notice",
  letter: "Letter",
  memo: "Memo",
  agreement: "Agreement",
};

/** `SPM-NTC-2026-014`: the prefix names the kind, the sequence never resets. */
export const DOCUMENT_NUMBER_PREFIX: Record<DocumentType, string> = {
  notice: "NTC",
  letter: "LTR",
  memo: "MEM",
  agreement: "AGR",
};

export const DOCUMENT_STATUSES = [
  "draft",
  "in_review",
  "sent",
  "completed",
  "void",
] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  sent: "Sent",
  completed: "Completed",
  void: "Void",
};

export const DOCUMENT_LANGUAGES = ["en", "bn", "both"] as const;
export type DocumentLanguage = (typeof DOCUMENT_LANGUAGES)[number];

/**
 * A4 in CSS pixels at 96 dpi. The letterhead template's page padding is in
 * points (40 / 26 / 52 pt); converted here once so the editor's page and the
 * printed page are the same object.
 */
const PT = 96 / 72;
export const PAGE = {
  width: Math.round(595 * PT), // 794
  height: Math.round(842 * PT), // 1123
  padX: Math.round(40 * PT), // 53
  padTop: Math.round(26 * PT), // 35 — where the letterhead starts
  /** Top margin of a page without the letterhead (20 mm, a plain sheet). */
  plainTop: Math.round(57 * PT), // 76
  padBottom: Math.round(52 * PT), // 69 — the footer band sits inside this
  /** The letterhead block (logo, contact column, rule) on every page. */
  letterheadHeight: 160, // fits the five-row contact column
  /** Space between the letterhead rule and the first line of text. */
  letterheadGap: 18,
  /** Room for a running header line when the document has one. */
  headerHeight: 20,
  /** Footer line (reference · page x of y) above the band. */
  footerHeight: 18,
  /** Gap drawn between pages on screen; zero on paper. */
  screenGap: 28,
} as const;

/** Where the text column starts and stops on a page with this chrome. */
export function contentHeight(opts: { letterhead: boolean; header: boolean }) {
  const top =
    (opts.letterhead
      ? PAGE.padTop + PAGE.letterheadHeight + PAGE.letterheadGap
      : PAGE.plainTop) + (opts.header ? PAGE.headerHeight : 0);
  const bottom = PAGE.padBottom + PAGE.footerHeight;
  return { top, bottom, height: PAGE.height - top - bottom };
}

export type DocumentFont = {
  id: string;
  label: string;
  /** The CSS family stack used by the editor and the printer. */
  family: string;
  /** Files under public/fonts/docs, by weight/style. */
  faces: { file: string; weight: number; style: "normal" | "italic" }[];
};

export const DOCUMENT_FONTS: DocumentFont[] = [
  {
    id: "plex-serif",
    label: "IBM Plex Serif",
    family: '"IBM Plex Serif", "Noto Sans Bengali", serif',
    faces: [
      { file: "PlexSerif-Regular.woff", weight: 400, style: "normal" },
      { file: "PlexSerif-Italic.woff", weight: 400, style: "italic" },
      { file: "PlexSerif-SemiBold.woff", weight: 600, style: "normal" },
      { file: "PlexSerif-Bold.woff", weight: 700, style: "normal" },
    ],
  },
  {
    id: "plex-sans",
    label: "IBM Plex Sans",
    family: '"IBM Plex Sans", "Noto Sans Bengali", sans-serif',
    faces: [
      { file: "PlexSans-Regular.woff", weight: 400, style: "normal" },
      { file: "PlexSans-Italic.woff", weight: 400, style: "italic" },
      { file: "PlexSans-SemiBold.woff", weight: 600, style: "normal" },
      { file: "PlexSans-Bold.woff", weight: 700, style: "normal" },
    ],
  },
  {
    id: "times",
    label: "Times New Roman",
    family: '"Tinos", "Times New Roman", "Noto Sans Bengali", serif',
    faces: [
      { file: "Tinos-Regular.woff", weight: 400, style: "normal" },
      { file: "Tinos-Italic.woff", weight: 400, style: "italic" },
      { file: "Tinos-Bold.woff", weight: 700, style: "normal" },
    ],
  },
  {
    id: "arial",
    label: "Arial",
    family: '"Arimo", "Arial", "Noto Sans Bengali", sans-serif',
    faces: [
      { file: "Arimo-Regular.woff", weight: 400, style: "normal" },
      { file: "Arimo-Italic.woff", weight: 400, style: "italic" },
      { file: "Arimo-Bold.woff", weight: 700, style: "normal" },
    ],
  },
  {
    id: "bengali",
    label: "Noto Sans Bengali",
    family: '"Noto Sans Bengali", "IBM Plex Sans", sans-serif',
    faces: [
      { file: "NotoSansBengali-Regular.woff", weight: 400, style: "normal" },
      { file: "NotoSansBengali-Bold.woff", weight: 700, style: "normal" },
    ],
  },
  {
    id: "plex-mono",
    label: "IBM Plex Mono",
    family: '"IBM Plex Mono", ui-monospace, monospace',
    faces: [{ file: "PlexMono-Regular.woff", weight: 400, style: "normal" }],
  },
];

/** The family names @font-face declares (one entry per file family). */
export const FONT_FACE_FAMILY: Record<string, string> = {
  PlexSerif: "IBM Plex Serif",
  PlexSans: "IBM Plex Sans",
  PlexMono: "IBM Plex Mono",
  Tinos: "Tinos",
  Arimo: "Arimo",
  NotoSansBengali: "Noto Sans Bengali",
};

export const FONT_SIZES = [
  8, 9, 10, 10.5, 11, 12, 13, 14, 16, 18, 20, 24, 28, 36,
];

export function fontById(id: string | null | undefined): DocumentFont {
  return DOCUMENT_FONTS.find((f) => f.id === id) ?? DOCUMENT_FONTS[0];
}

/** Every @font-face rule, with the file URL resolved by the caller. */
export function fontFaceCss(urlFor: (file: string) => string): string {
  const rules: string[] = [];
  for (const f of DOCUMENT_FONTS) {
    for (const face of f.faces) {
      const family = FONT_FACE_FAMILY[face.file.split("-")[0]] ?? f.label;
      rules.push(
        `@font-face{font-family:"${family}";font-weight:${face.weight};font-style:${face.style};font-display:swap;src:url("${urlFor(face.file)}") format("woff")}`,
      );
    }
  }
  return rules.join("\n");
}
