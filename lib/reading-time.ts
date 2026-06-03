/** Estimated reading time (minutes) from HTML, at ~200 words/min. Min 1. */
export function readingTimeMin(html: string | undefined | null): number {
  const text = (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = text ? text.split(" ").length : 0;
  return Math.max(1, Math.round(words / 200));
}

/** Plain-text excerpt from HTML, trimmed to ~max chars (word boundary). */
export function excerptFromHtml(
  html: string | undefined | null,
  max = 180,
): string {
  const text = (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(" ", max)).trim() + "…";
}
