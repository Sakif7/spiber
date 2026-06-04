import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Public, un-authenticated delivery of uploaded images (product/banner/brand
 * thumbnails). Streams from the storage layer rather than relying on Next's
 * static `public/` handler — under `output: 'standalone'` that handler serves a
 * build-time copy of `public/`, so runtime uploads on a mounted volume would
 * 404 (and break `next/image`). `publicOnly` guarantees this never reaches the
 * gated/private store. (When R2 is configured, public images use the R2 public
 * URL directly and this route isn't involved.)
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
  if (!key || key.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage()
    .getObject({ key, range, publicOnly: true })
    .catch(() => null);
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  // Public, immutable assets (keys are content-unique) — cache hard.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("Content-Disposition", "inline");
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}
