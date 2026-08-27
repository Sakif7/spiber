import { requireSuperAdmin } from "@/lib/auth/guard";
import { getSessionUser } from "@/lib/auth/current-user";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { companyDocumentUpdateSchema } from "@/lib/schemas/company-document";
import {
  updateCompanyDocumentMeta,
  softDeleteCompanyDocument,
} from "@/lib/repositories/company-documents.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function guard() {
  const admin = await requireSuperAdmin();
  if (admin) return { admin } as const;
  const user = await getSessionUser();
  return {
    admin: null,
    res: fail({ code: user ? "forbidden" : "unauthorized" }, user ? 403 : 401),
  } as const;
}

/** Rename / re-folder a vault document (metadata only). Super-admin, audited. */
export async function PATCH(req: Request, { params }: Params) {
  const g = await guard();
  if (!g.admin) return g.res;
  const { id } = await params;

  const parsed = await parseJson(req, companyDocumentUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }

  const doc = await updateCompanyDocumentMeta(id, parsed.data).catch(
    () => null,
  );
  if (!doc) return fail({ code: "not_found" }, 404);

  await writeAudit({
    actorId: g.admin.sub,
    action: "companyDocument.update",
    entityType: "CompanyDocument",
    entityId: id,
    after: parsed.data,
  });
  return ok({ id, title: doc.title, folder: doc.folder ?? null });
}

/** Soft-delete a vault document. Super-admin, audited. */
export async function DELETE(_req: Request, { params }: Params) {
  const g = await guard();
  if (!g.admin) return g.res;
  const { id } = await params;

  const doc = await softDeleteCompanyDocument(id).catch(() => null);
  if (!doc) return fail({ code: "not_found" }, 404);

  await writeAudit({
    actorId: g.admin.sub,
    action: "companyDocument.delete",
    entityType: "CompanyDocument",
    entityId: id,
    after: { title: doc.title },
  });
  return ok({ id });
}
