import { getSoftwareProductByIdLean } from "@/lib/repositories/software.repo";
import { hasPaidPurchase } from "@/lib/repositories/purchases.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Secure download of a software product's asset. Login-gated: the user must own
 * a PAID purchase of the product. The file streams from storage (R2/local) via
 * the authenticated S3 API with HTTP Range support — never a public URL — and
 * is served as an attachment.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ productId: string }> },
) {
  const { productId } = await params;

  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  let product;
  try {
    product = await getSoftwareProductByIdLean(productId);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!product || product.deliveryType !== "asset" || !product.assetKey) {
    return new Response("Not found", { status: 404 });
  }

  const owns = await hasPaidPurchase(user.sub, productId);
  if (!owns) return new Response("Forbidden", { status: 403 });

  const range = req.headers.get("range") ?? undefined;
  const obj = await getStorage().getObject({
    key: toStorageKey(product.assetKey),
    range,
  });
  if (!obj) return new Response("Not found", { status: 404 });

  const headers = new Headers();
  headers.set("Content-Type", obj.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set(
    "Content-Disposition",
    `attachment; filename="${downloadName(product.slug, product.assetKey)}"`,
  );
  if (obj.contentLength != null) {
    headers.set("Content-Length", String(obj.contentLength));
  }
  if (obj.contentRange) headers.set("Content-Range", obj.contentRange);

  return new Response(obj.body, { status: obj.status, headers });
}

/** Recover the storage key from a stored key or a legacy public URL. */
function toStorageKey(assetKey: string): string {
  if (/^https?:\/\//i.test(assetKey)) {
    try {
      return new URL(assetKey).pathname.replace(/^\/+/, "");
    } catch {
      return assetKey;
    }
  }
  return assetKey.replace(/^\/?uploads\//, "");
}

function downloadName(slug: string, assetKey: string): string {
  const ext = assetKey.includes(".")
    ? "." +
      assetKey
        .split(".")
        .pop()!
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
    : "";
  return `${slug.replace(/[^\w-]+/g, "-")}${ext}`;
}
