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
    mergeField: {
      insertMergeField: (field: string) => ReturnType;
      /** Give the node views their values (screen only). */
      setMergeValues: (values: Record<string, string>) => ReturnType;
    };
    tableOfContents: {
      insertTableOfContents: () => ReturnType;
      /** The pager's page per top-level block (screen only). */
      setTocPages: (pageOfBlock: number[]) => ReturnType;
    };
    footnote: {
      insertFootnote: (text?: string) => ReturnType;
      setFootnoteText: (id: string, text: string) => ReturnType;
      removeFootnote: (id: string) => ReturnType;
      /** Which note's card is open on screen (null closes it). */
      setFootnoteOpen: (id: string | null) => ReturnType;
    };
  }
  interface Storage {
    footnote: { open: string | null; listeners: Set<() => void> };
    mergeField: { values: Record<string, string>; listeners: Set<() => void> };
    tableOfContents: { pageOfBlock: number[]; listeners: Set<() => void> };
  }
}

/** Every footnote in the body, in reading order: id, text, number. */
export function footnotesIn(doc: {
  descendants: (
    fn: (node: {
      type: { name: string };
      attrs: Record<string, unknown>;
    }) => void,
  ) => void;
}): { id: string; text: string; n: number }[] {
  const out: { id: string; text: string; n: number }[] = [];
  doc.descendants((node) => {
    if (node.type.name === "footnote") {
      out.push({
        id: String(node.attrs.id ?? ""),
        text: String(node.attrs.text ?? ""),
        n: out.length + 1,
      });
    }
  });
  return out;
}

/** The headings a table of contents lists: top-level, up to `depth`. */
export function tocEntries(
  doc: {
    forEach: (
      fn: (
        node: {
          type: { name: string };
          attrs: Record<string, unknown>;
          textContent: string;
        },
        offset: number,
        index: number,
      ) => void,
    ) => void;
  },
  depth: number,
): { level: number; text: string; block: number }[] {
  const out: { level: number; text: string; block: number }[] = [];
  doc.forEach((node, _offset, index) => {
    if (node.type.name !== "heading") return;
    const level = Number(node.attrs.level ?? 1);
    if (level <= depth && node.textContent.trim())
      out.push({ level, text: node.textContent, block: index });
  });
  return out;
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
/**
 * An attribute that lives in the node's own markup (a data-* attribute or
 * its text) rather than being echoed as a raw HTML attribute: `renderHTML`
 * adds nothing, `parseHTML` reads it back from where the node put it.
 */
function quiet<T>(parse: (el: HTMLElement) => T, fallback: T = "" as T) {
  return {
    default: fallback,
    parseHTML: (el: HTMLElement) => parse(el),
    renderHTML: () => ({}),
  };
}

export const SignatureSlot = Node.create({
  name: "signatureSlot",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    const text = (el: HTMLElement, sel: string) =>
      el.querySelector(sel)?.textContent ?? "";
    return {
      slotId: quiet((el) => el.getAttribute("data-signature-slot") ?? ""),
      employeeId: quiet((el) => el.getAttribute("data-employee-id") ?? ""),
      name: quiet((el) => text(el, ".doc-signature-name")),
      title: quiet((el) => text(el, ".doc-signature-title")),
      label: quiet(
        (el) => text(el, ".doc-signature-empty") || "Signature",
        "Signature",
      ),
      /** Set by the server once signed: an image URL and the date line. */
      signedImage: quiet(
        (el) =>
          el.querySelector<HTMLImageElement>(".doc-signature-image img")?.src ??
          null,
        null,
      ),
      signedLine: quiet(
        (el) => el.querySelector(".doc-signature-line")?.textContent ?? null,
        null,
      ),
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

/**
 * A merge field — `{{employee.name}}` in a letter. Stored with only its key;
 * the value is render-time state: the printer fills `value` from the
 * addressee, and on screen the node view reads the values the editor holds
 * (`storage.values`), so picking a different person redraws every field
 * without touching the document.
 */
export const MergeField = Node.create<
  Record<string, never>,
  { values: Record<string, string>; listeners: Set<() => void> }
>({
  name: "mergeField",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addStorage() {
    return { values: {}, listeners: new Set<() => void>() };
  },
  addAttributes() {
    return {
      field: quiet((el) => el.getAttribute("data-merge-field") ?? ""),
      /** Set for a render; never stored (a paste starts unfilled). */
      value: quiet(() => null, null),
    };
  },
  parseHTML() {
    return [{ tag: "span[data-merge-field]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    const field = String(node.attrs.field ?? "");
    const value = node.attrs.value as string | null;
    const filled = value !== null && value !== undefined;
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-merge-field": field,
        class: `doc-merge-field${filled ? " is-filled" : ""}`,
      }),
      filled ? value : `{{${field}}}`,
    ];
  },
  addNodeView() {
    const storage = this.storage;
    return ({ node }) => {
      const dom = document.createElement("span");
      dom.setAttribute("data-merge-field", String(node.attrs.field ?? ""));
      dom.contentEditable = "false";
      let current = node;
      const paint = () => {
        const field = String(current.attrs.field ?? "");
        const value =
          (current.attrs.value as string | null) ?? storage.values[field];
        const filled = value !== undefined && value !== null && value !== "";
        dom.className = `doc-merge-field${filled ? " is-filled" : ""}`;
        dom.textContent = filled ? value : `{{${field}}}`;
        dom.title = filled
          ? `{{${field}}}`
          : value === ""
            ? "Nothing to show yet (a draft has no number)"
            : "No value yet — pick who it is addressed to";
      };
      paint();
      storage.listeners.add(paint);
      return {
        dom,
        update: (next) => {
          if (next.type.name !== "mergeField") return false;
          current = next;
          paint();
          return true;
        },
        destroy: () => {
          storage.listeners.delete(paint);
        },
      };
    };
  },
  addCommands() {
    return {
      insertMergeField:
        (field) =>
        ({ chain }) =>
          chain().insertContent({ type: this.name, attrs: { field } }).run(),
      setMergeValues: (values) => () => {
        this.storage.values = values;
        this.storage.listeners.forEach((fn) => fn());
        return true;
      },
    };
  },
});

/**
 * A table of contents: the document's headings with the page each starts
 * on. Empty in the stored HTML — the editor's node view lists the headings
 * itself and takes the page numbers from the pager; the printer fills it
 * after pagination (and paginates once more, since the list has height).
 */
export const TableOfContents = Node.create<
  Record<string, never>,
  { pageOfBlock: number[]; listeners: Set<() => void> }
>({
  name: "tableOfContents",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addStorage() {
    return { pageOfBlock: [], listeners: new Set<() => void>() };
  },
  addAttributes() {
    return {
      title: quiet(
        (el) => el.getAttribute("data-toc-title") ?? "Contents",
        "Contents",
      ),
      /** Heading levels listed: 1 = only H1, 3 = H1–H3. */
      depth: quiet((el) => Number(el.getAttribute("data-toc")) || 3, 3),
    };
  },
  parseHTML() {
    return [{ tag: "div[data-toc]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-toc": String(node.attrs.depth ?? 3),
        "data-toc-title": String(node.attrs.title ?? "Contents"),
        class: "doc-toc",
      }),
      [
        "div",
        { class: "doc-toc-title" },
        String(node.attrs.title ?? "Contents"),
      ],
      ["ol", { class: "doc-toc-list" }],
    ];
  },
  addNodeView() {
    const storage = this.storage;
    const editor = this.editor;
    return ({ node, getPos }) => {
      const dom = document.createElement("div");
      dom.className = "doc-toc";
      dom.contentEditable = "false";
      const title = document.createElement("div");
      title.className = "doc-toc-title";
      const list = document.createElement("ol");
      list.className = "doc-toc-list";
      dom.append(title, list);
      let current = node;
      const paint = () => {
        title.textContent = String(current.attrs.title ?? "Contents");
        const depth = Number(current.attrs.depth ?? 3);
        const entries = tocEntries(editor.state.doc, depth);
        list.replaceChildren();
        if (entries.length === 0) {
          const li = document.createElement("li");
          li.className = "doc-toc-empty";
          li.textContent = "Headings you add will be listed here.";
          list.append(li);
          return;
        }
        for (const e of entries) {
          const li = document.createElement("li");
          li.className = `doc-toc-item level-${e.level}`;
          const text = document.createElement("span");
          text.className = "doc-toc-text";
          text.textContent = e.text;
          const page = document.createElement("span");
          page.className = "doc-toc-page";
          const p = storage.pageOfBlock[e.block];
          page.textContent = p ? String(p) : "–";
          li.append(text, page);
          list.append(li);
        }
      };
      paint();
      storage.listeners.add(paint);
      const onUpdate = () => paint();
      editor.on("update", onUpdate);
      return {
        dom,
        update: (next) => {
          if (next.type.name !== "tableOfContents") return false;
          current = next;
          paint();
          return true;
        },
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
        stopEvent: () => false,
        ignoreMutation: () => true,
        destroy: () => {
          storage.listeners.delete(paint);
          editor.off("update", onUpdate);
          void getPos;
        },
      };
    };
  },
  addCommands() {
    return {
      insertTableOfContents:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name })
            .createParagraphNear()
            .run(),
      setTocPages: (pageOfBlock) => () => {
        this.storage.pageOfBlock = pageOfBlock;
        this.storage.listeners.forEach((fn) => fn());
        return true;
      },
    };
  },
});

/**
 * A footnote: a numbered reference in the text, its note at the foot of the
 * page the reference lands on. The note's text lives on the node; the
 * number is its place in reading order, worked out wherever it is drawn
 * (node view, printer, Word export), so the stored HTML carries only a
 * marker. Editing happens in a small popover the editor opens on click.
 */
export const Footnote = Node.create<
  Record<string, never>,
  { open: string | null; listeners: Set<() => void> }
>({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addStorage() {
    return { open: null, listeners: new Set<() => void>() };
  },
  addAttributes() {
    return {
      id: quiet((el) => el.getAttribute("data-footnote") ?? ""),
      text: quiet((el) => el.getAttribute("data-note") ?? ""),
    };
  },
  parseHTML() {
    // Ahead of the superscript mark, which would otherwise claim the <sup>.
    return [{ tag: "sup[data-footnote]", priority: 60 }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, {
        "data-footnote": String(node.attrs.id ?? ""),
        "data-note": String(node.attrs.text ?? ""),
        class: "doc-footnote-ref",
      }),
      "*",
    ];
  },
  addNodeView() {
    const editor = this.editor;
    const storage = this.storage;
    return ({ node }) => {
      const dom = document.createElement("sup");
      dom.className = "doc-footnote-ref";
      dom.contentEditable = "false";
      let current = node;
      const paint = () => {
        const id = String(current.attrs.id ?? "");
        dom.setAttribute("data-footnote", id);
        dom.setAttribute("data-note", String(current.attrs.text ?? ""));
        const n = footnotesIn(editor.state.doc).find((f) => f.id === id)?.n;
        dom.textContent = n ? String(n) : "*";
        dom.title =
          String(current.attrs.text ?? "") || "Click to write the note";
        dom.classList.toggle("is-open", storage.open === id);
      };
      paint();
      const onUpdate = () => paint();
      editor.on("update", onUpdate);
      storage.listeners.add(paint);
      dom.addEventListener("click", (e) => {
        e.preventDefault();
        editor.commands.setFootnoteOpen(String(current.attrs.id ?? ""));
      });
      return {
        dom,
        update: (next) => {
          if (next.type.name !== "footnote") return false;
          current = next;
          paint();
          return true;
        },
        selectNode: () => dom.classList.add("ProseMirror-selectednode"),
        deselectNode: () => dom.classList.remove("ProseMirror-selectednode"),
        ignoreMutation: () => true,
        destroy: () => {
          editor.off("update", onUpdate);
          storage.listeners.delete(paint);
        },
      };
    };
  },
  addCommands() {
    return {
      insertFootnote:
        (text = "") =>
        ({ chain }) => {
          const id = Math.random().toString(36).slice(2, 10);
          const ok = chain()
            .insertContent({ type: this.name, attrs: { id, text } })
            .run();
          if (ok) {
            this.storage.open = id;
            this.storage.listeners.forEach((fn) => fn());
          }
          return ok;
        },
      setFootnoteText:
        (id, text) =>
        ({ tr, state, dispatch }) => {
          let done = false;
          state.doc.descendants((node, pos) => {
            if (done) return false;
            if (node.type.name === this.name && node.attrs.id === id) {
              if (dispatch)
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, text });
              done = true;
              return false;
            }
            return true;
          });
          return done;
        },
      setFootnoteOpen: (id) => () => {
        this.storage.open = id;
        this.storage.listeners.forEach((fn) => fn());
        return true;
      },
      removeFootnote:
        (id) =>
        ({ tr, state, dispatch }) => {
          let done = false;
          state.doc.descendants((node, pos) => {
            if (done) return false;
            if (node.type.name === this.name && node.attrs.id === id) {
              if (dispatch) tr.delete(pos, pos + node.nodeSize);
              done = true;
              return false;
            }
            return true;
          });
          return done;
        },
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
    MergeField,
    TableOfContents,
    Footnote,
  ];
}
