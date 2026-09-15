import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopType,
  TextRun,
  UnderlineType,
  WidthType,
  type IParagraphOptions,
  type IRunOptions,
  type ParagraphChild,
} from "docx";
import { pngDimensions } from "@/lib/services/pdf-asset.service";
import { publicImage } from "@/lib/pdf/engine/assets";
import { fontById } from "@/lib/documents/types";
import type { ChromeCompany } from "@/lib/documents/chrome";
import type {
  DocumentBody,
  DocumentSettings,
} from "@/lib/schemas/authored-document";

/**
 * A document body → a Word file. Paragraph by paragraph: headings, lists,
 * tables, pictures, page breaks, the letterhead as a page header and the
 * reference line with page numbers as the footer — so a notice opens in
 * Word looking like the PDF, editable. Fields that only mean something to
 * the printer (merge values, signed slots) are written as their text.
 */
export type DocxExportInput = {
  body: DocumentBody;
  settings: DocumentSettings;
  company: ChromeCompany;
  number: string | null;
  title: string;
};

type JsonNode = {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
};

// Word measures in twips (1/20 pt) and half-points; the page is A4.
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 1134; // 20 mm
const TEXT_W = PAGE_W - 2 * MARGIN;

const HEADING: Record<
  number,
  (typeof HeadingLevel)[keyof typeof HeadingLevel]
> = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
};

const ALIGN: Record<
  string,
  (typeof AlignmentType)[keyof typeof AlignmentType]
> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

function jpegDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    // SOF0–SOF15 (except DHT/JPG/DAC) carry the frame size.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      ![0xc4, 0xc8, 0xcc].includes(marker)
    ) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    i += 2 + len;
  }
  return null;
}

/** A data URI → bytes, type and pixel size (PNG/JPEG only — what the editor stores). */
function decodeImage(
  src: string,
): { data: Buffer; type: "png" | "jpg"; width: number; height: number } | null {
  const m = /^data:image\/(png|jpe?g);base64,(.+)$/i.exec(src);
  if (!m) return null;
  const data = Buffer.from(m[2], "base64");
  const isPng = m[1].toLowerCase() === "png";
  const dims = isPng ? pngDimensions(data) : jpegDimensions(data);
  if (!dims) return null;
  return { data, type: isPng ? "png" : "jpg", ...dims };
}

/** Footnotes gathered while walking: Word numbers them in reading order too. */
type NoteBook = {
  count: number;
  notes: Record<number, { children: Paragraph[] }>;
};

function runsOf(
  nodes: JsonNode[] | undefined,
  base: IRunOptions,
  book: NoteBook,
): ParagraphChild[] {
  const out: ParagraphChild[] = [];
  for (const n of nodes ?? []) {
    if (n.type === "text") {
      const o: { -readonly [K in keyof IRunOptions]: IRunOptions[K] } & {
        text: string;
      } = { ...base, text: n.text ?? "" };
      for (const m of n.marks ?? []) {
        if (m.type === "bold") o.bold = true;
        if (m.type === "italic") o.italics = true;
        if (m.type === "underline")
          o.underline = { type: UnderlineType.SINGLE };
        if (m.type === "strike") o.strike = true;
        if (m.type === "subscript") o.subScript = true;
        if (m.type === "superscript") o.superScript = true;
        if (m.type === "highlight") {
          const c = String(m.attrs?.color ?? "");
          if (/^#[0-9a-f]{6}$/i.test(c))
            o.shading = { type: ShadingType.CLEAR, fill: c.slice(1) };
          else o.highlight = "yellow";
        }
        if (m.type === "textStyle") {
          const color = String(m.attrs?.color ?? "");
          if (/^#[0-9a-f]{6}$/i.test(color)) o.color = color.slice(1);
          const fam = String(m.attrs?.fontFamily ?? "");
          if (fam) o.font = fam.split(",")[0].replace(/["']/g, "").trim();
          const size = String(m.attrs?.fontSize ?? "");
          const pt = /^(\d+(?:\.\d+)?)pt$/.exec(size);
          if (pt) o.size = Math.round(Number(pt[1]) * 2);
        }
      }
      out.push(new TextRun(o));
    } else if (n.type === "hardBreak") {
      out.push(new TextRun({ ...base, break: 1 }));
    } else if (n.type === "footnote") {
      book.count += 1;
      book.notes[book.count] = {
        children: [
          new Paragraph({
            children: [
              new TextRun({
                ...base,
                size: 18,
                text: String(n.attrs?.text ?? ""),
              }),
            ],
          }),
        ],
      };
      out.push(new FootnoteReferenceRun(book.count));
    } else if (n.type === "mergeField") {
      const value = n.attrs?.value;
      out.push(
        new TextRun({
          ...base,
          text:
            value === null || value === undefined
              ? `{{${String(n.attrs?.field ?? "")}}}`
              : String(value),
        }),
      );
    }
  }
  return out;
}

export async function exportDocx(input: DocxExportInput): Promise<Buffer> {
  const font = fontById(input.settings.font);
  const family = font.family.split(",")[0].replace(/["']/g, "").trim();
  const base: IRunOptions = { font: family, size: input.settings.fontSize * 2 };
  const paragraphOpts = (n: JsonNode): IParagraphOptions => {
    const a = n.attrs ?? {};
    const align = ALIGN[String(a.textAlign ?? "")];
    const indent = Number(a.indent ?? 0);
    const spaceAfter = a.spaceAfter as number | null | undefined;
    const lineHeight = a.lineHeight as number | null | undefined;
    return {
      ...(align ? { alignment: align } : {}),
      ...(indent ? { indent: { left: indent * 720 } } : {}),
      spacing: {
        after: spaceAfter != null ? Math.round(spaceAfter * 20) : 160,
        ...(lineHeight ? { line: Math.round(lineHeight * 240) } : {}),
      },
    };
  };

  const children: (Paragraph | Table)[] = [];
  const book: NoteBook = { count: 0, notes: {} };
  const walkBlocks = (
    nodes: JsonNode[],
    listNumbering?: { ref: string; level: number },
  ) => {
    for (const n of nodes) {
      switch (n.type) {
        case "paragraph":
          children.push(
            new Paragraph({
              ...paragraphOpts(n),
              ...(listNumbering
                ? {
                    numbering: {
                      reference: listNumbering.ref,
                      level: listNumbering.level,
                    },
                  }
                : {}),
              children: runsOf(n.content, base, book),
            }),
          );
          break;
        case "heading": {
          const level = Number(n.attrs?.level ?? 1);
          children.push(
            new Paragraph({
              ...paragraphOpts(n),
              heading: HEADING[level] ?? HeadingLevel.HEADING_4,
              children: runsOf(n.content, { ...base, size: undefined }, book),
            }),
          );
          break;
        }
        case "blockquote":
          for (const p of n.content ?? []) {
            children.push(
              new Paragraph({
                ...paragraphOpts(p),
                indent: { left: 720 },
                border: {
                  left: {
                    style: BorderStyle.SINGLE,
                    size: 12,
                    color: "0D8F91",
                    space: 8,
                  },
                },
                children: runsOf(p.content, { ...base, italics: true }, book),
              }),
            );
          }
          break;
        case "bulletList":
        case "orderedList": {
          const ref = n.type === "bulletList" ? "bullets" : "numbers";
          const level = listNumbering ? listNumbering.level + 1 : 0;
          for (const item of n.content ?? []) {
            const [first, ...rest] = item.content ?? [];
            if (first) walkBlocks([first], { ref, level: Math.min(level, 8) });
            if (rest.length)
              walkBlocks(rest, { ref, level: Math.min(level, 8) });
          }
          break;
        }
        case "horizontalRule":
          children.push(
            new Paragraph({
              border: {
                bottom: { style: BorderStyle.SINGLE, size: 6, color: "999999" },
              },
              spacing: { after: 160 },
            }),
          );
          break;
        case "pageBreak":
          children.push(new Paragraph({ children: [new PageBreak()] }));
          break;
        case "image": {
          const img = decodeImage(String(n.attrs?.src ?? ""));
          if (!img) break;
          const pct = Math.min(100, Math.max(5, Number(n.attrs?.width ?? 100)));
          const widthPx = (((TEXT_W / 20) * 96) / 72) * (pct / 100);
          const heightPx = (widthPx * img.height) / img.width;
          const align =
            ALIGN[String(n.attrs?.align ?? "center")] ?? AlignmentType.CENTER;
          children.push(
            new Paragraph({
              alignment: align,
              spacing: { after: 160 },
              children: [
                new ImageRun({
                  type: img.type,
                  data: img.data,
                  transformation: {
                    width: Math.round(widthPx),
                    height: Math.round(heightPx),
                  },
                }),
              ],
            }),
          );
          break;
        }
        case "table": {
          const rows = (n.content ?? []).map(
            (row) =>
              new TableRow({
                children: (row.content ?? []).map((cell) => {
                  const cellParas = (cell.content ?? []).map(
                    (p) =>
                      new Paragraph({
                        ...paragraphOpts(p),
                        spacing: { after: 60 },
                        children: runsOf(
                          p.content,
                          {
                            ...base,
                            ...(cell.type === "tableHeader"
                              ? { bold: true }
                              : {}),
                          },
                          book,
                        ),
                      }),
                  );
                  return new TableCell({
                    children: cellParas.length
                      ? cellParas
                      : [new Paragraph("")],
                    columnSpan: Number(cell.attrs?.colspan ?? 1) || 1,
                    rowSpan: Number(cell.attrs?.rowspan ?? 1) || 1,
                    ...(cell.type === "tableHeader"
                      ? { shading: { type: ShadingType.CLEAR, fill: "E6F2F2" } }
                      : {}),
                    margins: { top: 60, bottom: 60, left: 100, right: 100 },
                  });
                }),
              }),
          );
          children.push(
            new Table({
              rows,
              width: { size: TEXT_W, type: WidthType.DXA },
            }),
          );
          children.push(new Paragraph({ spacing: { after: 120 } }));
          break;
        }
        case "signatureSlot": {
          const a = n.attrs ?? {};
          const signed =
            typeof a.signedImage === "string"
              ? decodeImage(a.signedImage)
              : null;
          if (signed) {
            const h = 44;
            children.push(
              new Paragraph({
                spacing: { before: 240, after: 0 },
                children: [
                  new ImageRun({
                    type: signed.type,
                    data: signed.data,
                    transformation: {
                      width: Math.round((h * signed.width) / signed.height),
                      height: h,
                    },
                  }),
                ],
              }),
            );
          } else {
            children.push(
              new Paragraph({
                spacing: { before: 480, after: 0 },
                children: [],
              }),
            );
          }
          children.push(
            new Paragraph({
              border: {
                top: { style: BorderStyle.SINGLE, size: 6, color: "1A1A1A" },
              },
              spacing: { before: 0, after: 0 },
              children: [
                new TextRun({
                  ...base,
                  text: String(a.name ?? ""),
                  bold: true,
                }),
              ],
            }),
          );
          children.push(
            new Paragraph({
              spacing: { after: a.signedLine ? 0 : 200 },
              children: [
                new TextRun({
                  ...base,
                  text: String(a.title ?? ""),
                  size: (base.size as number) - 2,
                }),
              ],
            }),
          );
          if (a.signedLine) {
            children.push(
              new Paragraph({
                spacing: { after: 200 },
                children: [
                  new TextRun({
                    ...base,
                    text: String(a.signedLine),
                    size: (base.size as number) - 4,
                    color: "6D7C82",
                  }),
                ],
              }),
            );
          }
          break;
        }
        case "tableOfContents": {
          children.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: [
                new TextRun({
                  font: family,
                  text: String(n.attrs?.title ?? "Contents"),
                }),
              ],
            }),
          );
          // The headings as a list; Word can turn it into a live field itself.
          const depth = Number(n.attrs?.depth ?? 3);
          for (const h of input.body.content ?? []) {
            const hn = h as JsonNode;
            if (hn.type !== "heading") continue;
            const level = Number(hn.attrs?.level ?? 1);
            if (level > depth) continue;
            const text = (hn.content ?? [])
              .map((c) => (c as JsonNode).text ?? "")
              .join("");
            if (!text.trim()) continue;
            children.push(
              new Paragraph({
                indent: { left: (level - 1) * 360 },
                tabStops: [
                  { type: TabStopType.RIGHT, position: TEXT_W, leader: "dot" },
                ],
                spacing: { after: 40 },
                children: [new TextRun({ ...base, text })],
              }),
            );
          }
          break;
        }
        default:
          if (n.content) walkBlocks(n.content, listNumbering);
      }
    }
  };
  walkBlocks((input.body.content ?? []) as JsonNode[]);

  // Letterhead: logo + contact block as the page header; reference line and
  // page numbers as the footer — the same stationery the PDF prints.
  const logo = input.settings.letterhead
    ? publicImage("letterhead-logo.png")
    : null;
  const logoDims = logo ? pngDimensions(logo) : null;
  const headerChildren: Paragraph[] = [];
  if (logo && logoDims) {
    headerChildren.push(
      new Paragraph({
        children: [
          new ImageRun({
            type: "png",
            data: logo,
            transformation: {
              width: 150,
              height: Math.round((150 * logoDims.height) / logoDims.width),
            },
          }),
        ],
      }),
    );
  }
  if (input.settings.letterhead) {
    const c = input.company;
    headerChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 0 },
        children: [
          new TextRun({
            font: "IBM Plex Sans",
            size: 16,
            text: `${c.phone}  ·  ${c.email}  ·  ${c.website}`,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: "0D8F91",
            space: 6,
          },
        },
        spacing: { after: 240 },
        children: [
          new TextRun({
            font: "IBM Plex Sans",
            size: 16,
            text: c.headOfficeAddress,
          }),
        ],
      }),
    );
  } else if (input.settings.header) {
    headerChildren.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            font: "IBM Plex Sans",
            size: 18,
            color: "444444",
            text: input.settings.header,
          }),
        ],
      }),
    );
  }
  const footerLine = input.settings.footer
    .replace(/\{\{number\}\}/g, input.number ?? "Draft")
    .replace(/\{\{title\}\}/g, input.title);

  const doc = new Document({
    creator: input.company.name,
    title: input.title,
    ...(book.count ? { footnotes: book.notes } : {}),
    styles: {
      default: {
        document: { run: { font: family, size: input.settings.fontSize * 2 } },
      },
      paragraphStyles: [1, 2, 3, 4].map((l) => ({
        id: `Heading${l}`,
        name: `Heading ${l}`,
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { font: family, bold: true, size: [36, 30, 26, 24][l - 1] },
        paragraph: {
          spacing: { before: 240, after: 120 },
          outlineLevel: l - 1,
        },
      })),
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [0, 1, 2].map((level) => ({
            level,
            format: LevelFormat.BULLET,
            text: ["•", "◦", "▪"][level],
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
            },
          })),
        },
        {
          reference: "numbers",
          levels: [0, 1, 2].map((level) => ({
            level,
            format:
              level === 1
                ? LevelFormat.LOWER_LETTER
                : level === 2
                  ? LevelFormat.LOWER_ROMAN
                  : LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } },
            },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H },
            margin: {
              top: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
              right: MARGIN,
            },
          },
        },
        headers: headerChildren.length
          ? { default: new Header({ children: headerChildren }) }
          : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                border: {
                  top: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: "D9D9D9",
                    space: 4,
                  },
                },
                tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W }],
                children: [
                  new TextRun({
                    font: "IBM Plex Sans",
                    size: 16,
                    color: "444444",
                    text: footerLine,
                  }),
                  ...(input.settings.pageNumbers
                    ? [
                        new TextRun({
                          font: "IBM Plex Mono",
                          size: 16,
                          color: "444444",
                          children: [
                            "\tPage ",
                            PageNumber.CURRENT,
                            " of ",
                            PageNumber.TOTAL_PAGES,
                          ],
                        }),
                      ]
                    : []),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
