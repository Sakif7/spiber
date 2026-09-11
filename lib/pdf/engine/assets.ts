import fs from "node:fs";
import path from "node:path";

/**
 * Read a bundled image once; a missing file must not break the document.
 *
 * react-pdf embeds whatever bytes it is given, so the 1024px site logo made
 * every generated PDF about 1.8 MB — for an image drawn 190pt wide, in a
 * document that gets emailed. Regenerate with `npm run make-pdf-assets`.
 */
const imageCache = new Map<string, Buffer | null>();

export function publicImage(name: string): Buffer | null {
  if (imageCache.has(name)) return imageCache.get(name)!;
  for (const candidate of [path.join("pdf", name), name]) {
    try {
      const buf = fs.readFileSync(
        path.join(process.cwd(), "public", candidate),
      );
      imageCache.set(name, buf);
      return buf;
    } catch {
      // try the next candidate
    }
  }
  imageCache.set(name, null);
  return null;
}
