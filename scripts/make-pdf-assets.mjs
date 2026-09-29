/**
 * Produce print-sized copies of the brand assets used in generated PDFs —
 * and the small logo that sits above an email signature.
 *
 * WHY
 *   @react-pdf/renderer embeds whatever image bytes it is given, at full size.
 *   The site logo is 1024x1024 (1.4 MB) but the letterhead draws it 150pt wide,
 *   so every proposal and invoice carried about 1.4 MB of image nobody could
 *   see — and those documents are emailed to clients.
 *
 *   The copies written here are ~3x the printed size, which is ample at 300dpi,
 *   and take a generated PDF from ~1.8 MB to ~70 KB.
 *
 *   The email logo is sent inside every message that carries a signature, so
 *   it is 2x its drawn width (150px) and no more.
 *
 * WHEN TO RUN
 *   Only when a brand asset changes. The output is committed, so neither the
 *   build nor the server needs an image library.
 *
 *   npm run make-pdf-assets
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "canvas";

const PUBLIC = path.join(process.cwd(), "public");

/**
 * Source → output (under public/<dir>, "pdf" unless named), and the width the
 * copy should have.
 *
 * `trim` crops the transparent/white margin around the artwork. The source logo
 * is a 1024 square with the lockup floating in the middle, but the letterhead
 * needs the lockup itself so it can be positioned against the teal rule the way
 * the printed stationery does.
 *
 * No signature asset: generated documents deliberately carry the signature
 * LINE and the name, never a reproduction of anyone's signature or the company
 * seal. Those go on the paper copy by hand.
 */
const ASSETS = [
  {
    src: "spibermed-logo.png",
    out: "letterhead-logo.png",
    width: 520,
    trim: true,
  },
  {
    src: "spibermed-logo.png",
    dir: "email",
    out: "logo.png",
    width: 300,
    trim: true,
  },
];

/** Bounding box of everything that is not transparent and not near-white. */
function contentBox(ctx, w, h) {
  const { data } = ctx.getImageData(0, 0, w, h);
  let top = h,
    left = w,
    right = -1,
    bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a < 12) continue;
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
      if (r > 244 && g > 244 && b > 244) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < 0) return { x: 0, y: 0, w, h };
  return { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

for (const asset of ASSETS) {
  const dir = asset.dir ?? "pdf";
  fs.mkdirSync(path.join(PUBLIC, dir), { recursive: true });
  const from = path.join(PUBLIC, asset.src);
  if (!fs.existsSync(from)) {
    console.warn(`skipped ${asset.src} — not in public/`);
    continue;
  }
  const img = await loadImage(from);

  let box = { x: 0, y: 0, w: img.width, h: img.height };
  if (asset.trim) {
    const probe = createCanvas(img.width, img.height);
    const pctx = probe.getContext("2d");
    pctx.drawImage(img, 0, 0);
    box = contentBox(pctx, img.width, img.height);
  }

  const scale = asset.width / box.w;
  const w = Math.round(box.w * scale);
  const h = Math.round(box.h * scale);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, box.x, box.y, box.w, box.h, 0, 0, w, h);
  const buf = canvas.toBuffer("image/png", { compressionLevel: 9 });
  fs.writeFileSync(path.join(PUBLIC, dir, asset.out), buf);
  console.log(
    `${asset.src} (${fs.statSync(from).size} B) → public/${dir}/${asset.out} ` +
      `${w}x${h}, ${buf.length} B`,
  );
}
