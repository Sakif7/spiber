import { getSessionUser } from "@/lib/auth/current-user";
import { requireSuperAdmin } from "@/lib/auth/guard";
import { getCompanyDocumentById } from "@/lib/repositories/company-documents.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { getStorage } from "@/lib/storage";
import { getVaultKey, decryptVaultBlob } from "@/lib/crypto/vault";
import { logger } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Gated delivery of a company-vault document. SUPER-ADMIN only, fail-closed
 * audit on every view, decrypted in memory (AES-256-GCM — the stored blob is
 * ciphertext, so storage can't serve it directly), Range support served from
 * the decrypted buffer, never cached. `?download=1` switches to attachment.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const admin = await requireSuperAdmin();
  if (!admin) {
    const user = await getSessionUser();
    return new Response(user ? "Forbidden" : "Unauthorized", {
      status: user ? 403 : 401,
    });
  }

  const doc = await getCompanyDocumentById(id).catch(() => null);
  if (!doc) return new Response("Not found", { status: 404 });

  const range = req.headers.get("range") ?? undefined;
  const isInitialView = !range || /^bytes=0-/.test(range);
  if (isInitialView) {
    // Fail-closed audit: no audit row, no document.
    try {
      await writeAudit({
        actorId: admin.sub,
        action: "companyDocument.view",
        entityType: "CompanyDocument",
        entityId: id,
        after: { title: doc.title, filename: doc.originalFilename },
      });
    } catch (e) {
      logger.warn("company-document audit write failed; denying access", e);
      return new Response("Audit unavailable", { status: 503 });
    }
  }

  const key = getVaultKey();
  if (!key) return new Response("Vault key unavailable", { status: 503 });

  const obj = await getStorage().getObject({ key: doc.fileKey });
  if (!obj) return new Response("Not found", { status: 404 });

  let plain: Buffer;
  try {
    plain = decryptVaultBlob(await streamToBuffer(obj.body), key);
  } catch (e) {
    logger.error("company-document decrypt failed (wrong key or tampering)", e);
    return new Response("Unreadable document", { status: 500 });
  }

  const disposition = new URL(req.url).searchParams.get("download")
    ? "attachment"
    : "inline";
  const headers = new Headers();
  headers.set("Content-Type", doc.contentType);
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Content-Disposition",
    `${disposition}; filename="${sanitizeFilename(doc.originalFilename)}"`,
  );

  // Serve Range slices from the decrypted buffer (GCM can't stream partials).
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    const start = m?.[1] ? Number.parseInt(m[1], 10) : 0;
    const end =
      m?.[2] && m[2] !== ""
        ? Math.min(Number.parseInt(m[2], 10), plain.length - 1)
        : plain.length - 1;
    if (!m || Number.isNaN(start) || start > end || start >= plain.length) {
      headers.set("Content-Range", `bytes */${plain.length}`);
      return new Response(null, { status: 416, headers });
    }
    const slice = plain.subarray(start, end + 1);
    headers.set("Content-Length", String(slice.length));
    headers.set("Content-Range", `bytes ${start}-${end}/${plain.length}`);
    return new Response(new Uint8Array(slice), { status: 206, headers });
  }

  headers.set("Content-Length", String(plain.length));
  return new Response(new Uint8Array(plain), { status: 200, headers });
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "document";
}
