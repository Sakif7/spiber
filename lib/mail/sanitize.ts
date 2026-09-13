import sanitizeHtml from "sanitize-html";

/**
 * Make a message body safe to render inside the admin.
 *
 * - scripts, forms, iframes, event handlers and javascript: links go;
 * - inline images (`cid:`) are rewritten to our own attachment URL;
 * - remote images are BLOCKED (tracking pixels): the `src` is moved to
 *   `data-blocked-src` and the caller shows a "load remote images" switch;
 * - a conservative set of inline styles survives so newsletters still look
 *   like themselves without being able to escape their box.
 */
export type SanitizedHtml = {
  html: string;
  blockedRemoteImages: number;
};

const STYLE_PROPS = [
  "color",
  "background-color",
  "background",
  "font-size",
  "font-weight",
  "font-style",
  "font-family",
  "text-align",
  "text-decoration",
  "line-height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "border",
  "border-top",
  "border-bottom",
  "border-left",
  "border-right",
  "border-radius",
  "border-collapse",
  "width",
  "max-width",
  "min-width",
  "height",
  "display",
  "vertical-align",
  "white-space",
  "word-break",
  // Newsletters hide their "preheader" line with these two; neither can move
  // content outside the message box.
  "overflow",
  "max-height",
];
const ANY = [/^[^;{}<>]*$/];

export function sanitizeMailHtml(
  raw: string,
  opts: { cidUrl: (cid: string) => string | null; allowRemoteImages?: boolean },
): SanitizedHtml {
  let blocked = 0;
  const html = sanitizeHtml(raw, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags.filter((t) => t !== "iframe"),
      "img",
      "h1",
      "h2",
      "center",
      "font",
      "u",
      "s",
      "del",
      "ins",
    ],
    allowedAttributes: {
      "*": ["style", "align", "valign", "width", "height", "dir", "title"],
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "width", "height", "data-blocked-src"],
      table: ["cellpadding", "cellspacing", "border", "bgcolor"],
      td: ["colspan", "rowspan", "bgcolor"],
      th: ["colspan", "rowspan", "bgcolor"],
      font: ["color", "size", "face"],
    },
    allowedStyles: {
      "*": Object.fromEntries(STYLE_PROPS.map((p) => [p, ANY])),
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["https", "http", "data", "cid"] },
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (tagName, attribs) => {
        const src = attribs.src ?? "";
        const out: Record<string, string> = { ...attribs };
        if (src.toLowerCase().startsWith("cid:")) {
          const url = opts.cidUrl(src.slice(4).replace(/^<|>$/g, ""));
          if (url) out.src = url;
          else delete out.src;
        } else if (/^https?:\/\//i.test(src) && !opts.allowRemoteImages) {
          blocked += 1;
          delete out.src;
          out["data-blocked-src"] = src;
        }
        return { tagName, attribs: out };
      },
    },
    // Keep the text of dropped wrappers (a <div> inside a table cell etc.).
    disallowedTagsMode: "discard",
  });
  return { html, blockedRemoteImages: blocked };
}

/** Plain text → minimal HTML (paragraphs + line breaks), for text-only mail. */
export function textToHtml(text: string): string {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}
