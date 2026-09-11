import { ok, fail } from "@/lib/http/respond";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { deleteAsset, loadAsset } from "@/lib/services/pdf-asset.service";
import { guardSales } from "../../../sales/_guard";

export const dynamic = "force-dynamic";

/** The image itself, decrypted in memory, for the editor's position pad. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardSales("pdf-assets", 120);
  if (!g.ok) return g.res;
  const asset = await loadAsset((await params).id);
  if (!asset) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(asset.data), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(asset.data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Remove a stamp image — refused while any template still uses it. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  const { id } = await params;
  const res = await deleteAsset(id);
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "in_use"
            ? "A template still uses this stamp. Remove it from the template first."
            : undefined,
      },
      res.code === "not_found" ? 404 : 409,
    );
  }
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "pdfAsset.delete",
      entityType: "PdfAsset",
      entityId: id,
    },
    req,
  );
  return ok(res.data);
}
