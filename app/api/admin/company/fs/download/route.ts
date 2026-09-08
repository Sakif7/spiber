// archiver 8 is pure ESM and exports format classes; the old callable
// `archiver("zip")` factory no longer exists.
import { ZipArchive } from "archiver";
import { Readable } from "node:stream";
import {
  zipManifest,
  readDocumentBytes,
} from "@/lib/services/company-fs.service";
import { auditDocumentView } from "@/lib/audit/document-view";
import { logger } from "@/lib/log";
import { guardFs, fsStatus } from "../_guard";

export const dynamic = "force-dynamic";

/**
 * Download a folder (or a selection) as a zip.
 *
 * Files are decrypted one at a time and appended as the archive streams, so
 * memory stays bounded to a single document however large the folder is — the
 * whole point of not building the archive in memory first.
 *
 * The audit is written BEFORE any bytes leave, and a failure to record the
 * download denies it: this is the same bulk-export-of-confidential-material
 * that the single-document route already treats as fail-closed.
 */
export async function GET(req: Request) {
  const g = await guardFs("fs-zip", 20);
  if (!g.ok) return g.res;

  const url = new URL(req.url);
  const folderIds = (url.searchParams.get("folderIds") ?? "")
    .split(",")
    .filter(Boolean);
  const fileIds = (url.searchParams.get("fileIds") ?? "")
    .split(",")
    .filter(Boolean);

  const manifest = await zipManifest({ folderIds, fileIds });
  if (!manifest.ok) {
    return new Response(manifest.code, { status: fsStatus(manifest.code) });
  }

  try {
    await auditDocumentView({
      actorId: g.actor.sub,
      action: "companyFs.download_zip",
      entityType: "CompanyVault",
      entityId: folderIds[0] ?? fileIds[0] ?? "root",
      after: {
        files: manifest.data.length,
        paths: manifest.data.slice(0, 20).map((e) => e.path),
      },
      req,
    });
  } catch (e) {
    logger.warn("vault zip audit write failed; denying access", e);
    return new Response("Audit unavailable", { status: 503 });
  }

  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on("warning", (e: unknown) => logger.warn("vault zip warning", e));
  archive.on("error", (e: unknown) => logger.error("vault zip failed", e));

  // Feed the archive in the background; the response streams as it fills.
  void (async () => {
    try {
      for (const entry of manifest.data) {
        const bytes = await readDocumentBytes(entry.doc);
        if (!bytes) {
          logger.warn("vault zip: skipping unreadable document", {
            id: String(entry.doc._id),
          });
          continue;
        }
        archive.append(bytes, { name: entry.path });
      }
      await archive.finalize();
    } catch (e) {
      logger.error("vault zip: aborting", e);
      archive.abort();
    }
  })();

  const filename =
    manifest.data.length === 1
      ? `${manifest.data[0]!.path.split("/").pop()}.zip`
      : "company-documents.zip";

  return new Response(
    Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>,
    {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.\- ]+/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
