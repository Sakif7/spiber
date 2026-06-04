import sanitizeHtml from "sanitize-html";

/**
 * Server-side sanitizer for rich blog HTML authored in TipTap. Applied on save
 * (stored clean) and again on render (defense in depth). Allowlist-based — only
 * formatting tags, links, and images survive; scripts/styles/iframes are stripped.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "h4",
    "blockquote",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "s",
    "code",
    "pre",
    "a",
    "img",
    "hr",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Reject protocol-relative URLs (//evil.com) — without an explicit scheme they
  // bypass the allowlist and can point off-site / at javascript: in some contexts.
  allowProtocolRelative: false,
  // External links open safely; relative R2/upload image URLs are allowed.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeRichHtml(html: string | undefined | null): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
