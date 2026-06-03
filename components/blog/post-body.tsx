import { sanitizeRichHtml } from "@/lib/sanitize";

/**
 * Renders sanitized blog HTML. Sanitized again here (defense in depth) before
 * dangerouslySetInnerHTML. Server component — sanitize-html runs server-side.
 */
export function PostBody({ html }: { html: string }) {
  const clean = sanitizeRichHtml(html);
  return (
    <div
      className="blog-prose"
      dangerouslySetInnerHTML={{ __html: clean }}
      style={{
        fontSize: "var(--fs-body-lg)",
        lineHeight: 1.8,
        color: "var(--color-text)",
      }}
    />
  );
}
