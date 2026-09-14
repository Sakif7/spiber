import {
  Extension,
  Node,
  mergeAttributes,
  type Extensions,
} from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Highlight from "@tiptap/extension-highlight";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import {
  BackgroundColor,
  Color,
  FontFamily,
  FontSize,
  TextStyle,
} from "@tiptap/extension-text-style";

/**
 * The one extension list the editor (browser) and the printer (server,
 * `@tiptap/html`) share, so a body always renders the same HTML. Anything
 * that only makes sense while typing (placeholder, comments UI) is added by
 * the editor on top; nothing here needs a DOM.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pageBreak: { setPageBreak: () => ReturnType };
    indent: { indent: () => ReturnType; outdent: () => ReturnType };
    paragraphSpacing: {
      setParagraphLineHeight: (value: number | null) => ReturnType;
      setParagraphSpaceAfter: (value: number | null) => ReturnType;
    };
    signatureSlot: {
      insertSignatureSlot: (attrs: SignatureSlotAttrs) => ReturnType;
    };
  }
}

/** A hard page break: everything after it starts on a new page. */
export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-page-break": "",
        class: "doc-page-break",
      }),
    ];
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name })
            .createParagraphNear()
            .run(),
    };
  },
});

export const INDENT_STEP_PX = 36;
const MAX_INDENT = 8;

/** Left indent on paragraphs and headings, in steps (Tab / Shift-Tab). */
export const Indent = Extension.create({
  name: "indent",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Number(el.getAttribute("data-indent")) || 0,
            renderHTML: (attrs) =>
              attrs.indent
                ? {
                    "data-indent": String(attrs.indent),
                    style: `margin-left:${attrs.indent * INDENT_STEP_PX}px`,
                  }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    const step =
      (delta: 1 | -1) =>
      () =>
      ({
        tr,
        state,
        dispatch,
      }: {
        tr: import("@tiptap/pm/state").Transaction;
        state: import("@tiptap/pm/state").EditorState;
        dispatch?: (tr: import("@tiptap/pm/state").Transaction) => void;
      }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name !== "paragraph" && node.type.name !== "heading")
            return;
          const next = Math.min(
            MAX_INDENT,
            Math.max(0, ((node.attrs.indent as number) ?? 0) + delta),
          );
          if (next !== node.attrs.indent) {
            tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
            changed = true;
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return { indent: step(1), outdent: step(-1) };
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // Inside a list, Tab nests; elsewhere it indents the paragraph.
        if (this.editor.isActive("listItem")) return false;
        return this.editor.commands.indent();
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem")) return false;
        return this.editor.commands.outdent();
      },
    };
  },
});

/**
 * Word-style paragraph spacing: line height (1 / 1.15 / 1.5 / 2) and space
 * after, as attributes of the block rather than marks on its text, so a
 * whole paragraph moves together and the printer sees the same block.
 */
export const ParagraphSpacing = Extension.create({
  name: "paragraphSpacing",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => {
              const v = parseFloat(el.style.lineHeight);
              return Number.isFinite(v) ? v : null;
            },
            renderHTML: (attrs) =>
              attrs.lineHeight
                ? { style: `line-height:${attrs.lineHeight}` }
                : {},
          },
          spaceAfter: {
            default: null,
            parseHTML: (el) => {
              const v = parseFloat(el.style.marginBottom);
              return Number.isFinite(v) ? v : null;
            },
            renderHTML: (attrs) =>
              attrs.spaceAfter !== null && attrs.spaceAfter !== undefined
                ? { style: `margin-bottom:${attrs.spaceAfter}px` }
                : {},
          },
        },
      },
    ];
  },
  addCommands() {
    const setAttr =
      (key: "lineHeight" | "spaceAfter") =>
      (value: number | null) =>
      ({
        tr,
        state,
        dispatch,
      }: {
        tr: import("@tiptap/pm/state").Transaction;
        state: import("@tiptap/pm/state").EditorState;
        dispatch?: (tr: import("@tiptap/pm/state").Transaction) => void;
      }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (node.type.name !== "paragraph" && node.type.name !== "heading")
            return;
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, [key]: value });
          changed = true;
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      };
    return {
      setParagraphLineHeight: setAttr("lineHeight"),
      setParagraphSpaceAfter: setAttr("spaceAfter"),
    };
  },
});

export type SignatureSlotAttrs = {
  slotId: string;
  employeeId: string;
  name: string;
  title: string;
  /** "Signature" / "Countersigned" — printed under the line. */
  label?: string;
};

/**
 * Where an employee's signature goes. Empty while the document is being
 * written; filled with their stored signature (image, name, date) by the
 * server when they acknowledge. Rendered as a box so its size on the page is
 * settled before anyone signs.
 */
export const SignatureSlot = Node.create({
  name: "signatureSlot",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      slotId: { default: "" },
      employeeId: { default: "" },
      name: { default: "" },
      title: { default: "" },
      label: { default: "Signature" },
      /** Set by the server once signed: an image URL and the date line. */
      signedImage: { default: null },
      signedLine: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-signature-slot]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const a = node.attrs as SignatureSlotAttrs & {
      signedImage: string | null;
      signedLine: string | null;
    };
    const signed = Boolean(a.signedImage);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-signature-slot": a.slotId,
        "data-employee-id": a.employeeId,
        class: `doc-signature-slot${signed ? " is-signed" : ""}`,
      }),
      [
        "div",
        { class: "doc-signature-image" },
        ...(signed
          ? [["img", { src: a.signedImage, alt: "" }]]
          : [
              [
                "span",
                { class: "doc-signature-empty" },
                a.label || "Signature",
              ],
            ]),
      ],
      ["div", { class: "doc-signature-name" }, a.name],
      ["div", { class: "doc-signature-title" }, a.title],
      ...(a.signedLine
        ? [["div", { class: "doc-signature-line" }, a.signedLine]]
        : []),
    ];
  },
  addCommands() {
    return {
      insertSignatureSlot:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .createParagraphNear()
            .run(),
    };
  },
});

/** Pictures with a width (percent of the text column) and an alignment. */
export const DocumentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: 100,
        parseHTML: (el) => Number(el.getAttribute("data-width")) || 100,
        renderHTML: (attrs) => ({
          "data-width": String(attrs.width),
          style: `width:${attrs.width}%`,
        }),
      },
      align: {
        default: "center",
        parseHTML: (el) => el.getAttribute("data-align") || "center",
        renderHTML: (attrs) => ({ "data-align": attrs.align }),
      },
    };
  },
});

export function documentExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      link: { openOnClick: false, autolink: true },
      codeBlock: false,
    }),
    TextStyle,
    Color,
    BackgroundColor,
    FontFamily,
    FontSize,
    Highlight.configure({ multicolor: true }),
    Subscript,
    Superscript,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TableKit.configure({ table: { resizable: true } }),
    DocumentImage.configure({ inline: false, allowBase64: true }),
    PageBreak,
    Indent,
    ParagraphSpacing,
    SignatureSlot,
  ];
}
