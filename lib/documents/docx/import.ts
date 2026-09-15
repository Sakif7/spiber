import mammoth from "mammoth";
import { generateJSON } from "@tiptap/html/server";
import { documentExtensions } from "@/lib/documents/extensions";
import {
  documentBodySchema,
  type DocumentBody,
} from "@/lib/schemas/authored-document";

/**
 * A Word file → a document body. mammoth turns the .docx into clean HTML
 * (headings, lists, tables, bold/italic/underline, pictures as data URIs);
 * the editor's own schema then reads that HTML, so what comes in is
 * exactly what the editor could have typed — anything it does not know
 * (text boxes, tracked changes) is dropped rather than kept as something
 * the printer cannot draw. Word's footnotes and endnotes, which mammoth
 * turns into "[1]" links and a list at the end, become the editor's own
 * footnotes again.
 */
export const MAX_DOCX_BYTES = 15 * 1024 * 1024;

export type DocxImport = {
  body: DocumentBody;
  /** mammoth's notes — an unknown style, a dropped element. */
  warnings: string[];
};

export type DocxImportError =
  | "not_docx"
  | "too_large"
  | "unreadable"
  | "too_big_for_a_document";

const NOTE_ITEM = /<li id="(footnote|endnote)-(\d+)">([\s\S]*?)<\/li>/g;
const NOTE_REF =
  /<sup><a href="#(footnote|endnote)-(\d+)" id="(?:footnote|endnote)-ref-\d+">\[\d+\]<\/a><\/sup>/g;
const NOTE_LIST =
  /<ol>(?:\s*<li id="(?:footnote|endnote)-\d+">[\s\S]*?<\/li>\s*)+<\/ol>/g;

const escapeAttr = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

/**
 * mammoth writes a note as `<sup><a href="#footnote-1">[1]</a></sup>` in
 * the text and `<li id="footnote-1"><p>… <a href="#footnote-ref-1">↑</a></p></li>`
 * in a list at the end. Put the note's words back on the reference, as
 * the editor's footnote node, and drop the list.
 */
export function recoverFootnotes(html: string): string {
  const notes = new Map<string, string>();
  for (const m of html.matchAll(NOTE_ITEM)) {
    const text = m[3]
      .replace(/<a href="#(?:footnote|endnote)-ref-\d+">[\s\S]*?<\/a>/g, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    notes.set(`${m[1]}-${m[2]}`, unescape(text));
  }
  if (notes.size === 0) return html;
  return html
    .replace(NOTE_REF, (_m, kind: string, n: string) => {
      const text = notes.get(`${kind}-${n}`) ?? "";
      return `<sup data-footnote="${kind[0]}${n}" data-note="${escapeAttr(text)}">*</sup>`;
    })
    .replace(NOTE_LIST, "");
}

const STYLE_MAP = [
  "u => u",
  "strike => s",
  "p[style-name='Title'] => h1:fresh",
  "p[style-name='Subtitle'] => h2:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
];

export async function importDocx(
  file: Buffer,
): Promise<
  { ok: true; data: DocxImport } | { ok: false; code: DocxImportError }
> {
  if (file.length > MAX_DOCX_BYTES) return { ok: false, code: "too_large" };
  // A .docx is a zip: "PK" then the two-byte version.
  if (file.length < 4 || file[0] !== 0x50 || file[1] !== 0x4b)
    return { ok: false, code: "not_docx" };
  let html: string;
  let messages: { type: string; message: string }[] = [];
  try {
    const out = await mammoth.convertToHtml(
      { buffer: file },
      {
        styleMap: STYLE_MAP,
        convertImage: mammoth.images.imgElement(async (image) => ({
          src: `data:${image.contentType};base64,${await image.readAsBase64String()}`,
        })),
      },
    );
    html = out.value;
    messages = out.messages;
  } catch {
    return { ok: false, code: "unreadable" };
  }
  const json = generateJSON(recoverFootnotes(html), documentExtensions());
  const body = documentBodySchema.safeParse(json);
  if (!body.success) return { ok: false, code: "too_big_for_a_document" };
  return {
    ok: true,
    data: {
      body:
        body.data.content && body.data.content.length > 0
          ? body.data
          : { type: "doc", content: [{ type: "paragraph" }] },
      warnings: [...new Set(messages.map((m) => m.message))].slice(0, 20),
    },
  };
}
