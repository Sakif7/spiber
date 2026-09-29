import sanitizeHtml from "sanitize-html";
import { decodeEntities } from "@/lib/mail/preview";
import {
  SIGNATURE_LOGO_ALT,
  SIGNATURE_LOGO_HEIGHT,
  SIGNATURE_LOGO_WIDTH,
} from "@/lib/mail/signature";

/**
 * What the composer's rich text may carry on the wire. Far stricter than the
 * reader's allowlist: only the marks and blocks the editor can make, links
 * on http(s)/mailto, no styles, no scripts of any kind. Anything pasted in
 * from elsewhere is reduced to that.
 *
 * One image, and only when the caller names a `logoCid`: the signature's
 * company logo (`<img data-mail-logo>`), rewritten to that inline part —
 * whatever its `src` said, it can only ever become our own logo. Every other
 * image goes, and without a `logoCid` so does the logo.
 */
export function sanitizeOutgoingHtml(
  raw: string,
  opts: { logoCid?: string } = {},
): string {
  return sanitizeHtml(raw, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "u",
      "s",
      "a",
      "ul",
      "ol",
      "li",
      "blockquote",
      "h1",
      "h2",
      "h3",
      "pre",
      "code",
      "div",
      "span",
      "hr",
      "img",
    ],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesByTag: { img: ["cid"] },
    allowProtocolRelative: false,
    transformTags: {
      img: (tagName, attribs) => ({
        tagName,
        attribs:
          opts.logoCid && "data-mail-logo" in attribs
            ? {
                src: `cid:${opts.logoCid}`,
                alt: SIGNATURE_LOGO_ALT,
                width: String(SIGNATURE_LOGO_WIDTH),
                height: String(SIGNATURE_LOGO_HEIGHT),
              }
            : ({} as Record<string, string>),
      }),
    },
    // An image left without a source (anything but the logo) goes whole.
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
    disallowedTagsMode: "discard",
  }).trim();
}

/**
 * The plain-text alternative of a rich message: blocks become paragraphs,
 * list items get a dash, quotes get the `>` prefix every mail client uses,
 * links keep their address when it differs from the text.
 */
export function htmlToText(html: string): string {
  let s = html.replace(/\r?\n/g, "");
  s = s
    .replace(
      /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi,
      (_, inner: string) =>
        `\n\n${htmlToText(inner)
          .split("\n")
          .map((l) => `> ${l}`)
          .join("\n")}\n\n`,
    )
    .replace(
      /<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, href: string, text: string) => {
        const t = text.replace(/<[^>]*>/g, "");
        const clean = decodeEntities(href);
        return t.trim() === clean ||
          (clean.startsWith("mailto:") && clean.slice(7) === t.trim())
          ? t
          : `${t} (${clean})`;
      },
    )
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(ul|ol)>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|pre|blockquote)>/gi, "\n\n")
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<[^>]*>/g, "");
  return decodeEntities(s)
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when the editor sent nothing but empty paragraphs. */
export function isBlankHtml(html: string): boolean {
  return htmlToText(html).length === 0;
}
