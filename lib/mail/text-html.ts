/**
 * Plain text → minimal HTML (paragraphs + line breaks). Shared by the server
 * (text-only mail, the HTML alternative of a plain send) and the composer
 * (the quoted original under a reply), so it has no dependencies.
 */
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
