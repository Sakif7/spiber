import { sanitizeRichHtml } from "@/lib/sanitize";
import { inArticleAdMarkup, withInArticleAds } from "@/lib/ads/adsense";

/**
 * Renders sanitized blog HTML. Sanitized again here (defense in depth) before
 * dangerouslySetInnerHTML. Server component — sanitize-html runs server-side.
 *
 * With `ad`, Google's in-article slots go in after sanitizing (the sanitizer
 * would strip them), so their space is in the first paint and the text never
 * jumps when an ad arrives. `AdsenseLoader` fills them.
 */
export function PostBody({
  html,
  ad,
}: {
  html: string;
  ad?: { client: string; slot: string; label: string };
}) {
  const clean = sanitizeRichHtml(html);
  const body = ad ? withInArticleAds(clean, inArticleAdMarkup(ad)) : clean;
  return (
    <div
      className="blog-prose"
      dangerouslySetInnerHTML={{ __html: body }}
      style={{
        fontSize: "var(--fs-body-lg)",
        lineHeight: 1.8,
        color: "var(--color-text)",
      }}
    />
  );
}
