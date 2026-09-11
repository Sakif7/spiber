import { ok, fail } from "@/lib/http/respond";
import { writeAudit } from "@/lib/repositories/audit.repo";
import { vaultConfigured } from "@/lib/crypto/vault";
import {
  listAssets,
  uploadAsset,
  MAX_ASSET_BYTES,
} from "@/lib/services/pdf-asset.service";
import { guardSales } from "../../sales/_guard";

export const dynamic = "force-dynamic";

/** The stamp images available to templates. */
export async function GET() {
  const g = await guardSales("pdf-templates");
  if (!g.ok) return g.res;
  return ok(await listAssets());
}

/**
 * Upload one PNG (multipart `file`, optional `name`).
 *
 * A seal or signature is the company's signature in practice, so it is
 * stored encrypted with the vault key — which therefore has to be set.
 */
export async function POST(req: Request) {
  const g = await guardSales("pdf-assets", 30);
  if (!g.ok) return g.res;
  if (!vaultConfigured()) {
    return fail(
      {
        code: "vault_not_configured",
        message:
          "COMPANY_VAULT_KEY is not set (64 hex chars). Stamps are stored encrypted only.",
      },
      503,
    );
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail({ code: "no_file" }, 400);
  if (file.size > MAX_ASSET_BYTES) {
    return fail({ code: "too_large", message: "PNG files up to 2 MB." }, 400);
  }
  const name = String(form?.get("name") ?? "").trim() || file.name;
  const res = await uploadAsset(
    { name, body: Buffer.from(await file.arrayBuffer()) },
    g.actor,
  );
  if (!res.ok) {
    return fail(
      {
        code: res.code,
        message:
          res.code === "bad_type"
            ? "Only PNG images can be stamped."
            : undefined,
      },
      res.code === "vault_not_configured" ? 503 : 400,
    );
  }
  await writeAudit(
    {
      actorId: g.actor.sub,
      action: "pdfAsset.upload",
      entityType: "PdfAsset",
      entityId: res.data.id,
      after: { name: res.data.name, size: res.data.size },
    },
    req,
  );
  return ok(res.data);
}
