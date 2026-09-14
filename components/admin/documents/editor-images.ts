/**
 * A picture dropped into a document is stored inside the document itself
 * (a data URI), so the body is self-contained for the printer and the
 * vault. Downscaled first: a 4000px phone photo would bloat the body and
 * print no better than 1600px does.
 */
const MAX_EDGE = 1600;
const MAX_BYTES = 900_000;

export async function fileToDocumentImage(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("not an image");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas unavailable");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // PNG keeps transparency (logos, signatures); photos go to JPEG.
  const keepPng = file.type === "image/png" && file.size < MAX_BYTES;
  let out = canvas.toDataURL(keepPng ? "image/png" : "image/jpeg", 0.86);
  if (out.length > MAX_BYTES * 1.4) out = canvas.toDataURL("image/jpeg", 0.7);
  return out;
}
