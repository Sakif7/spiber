import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { deleteFolder, renameFolder } from "@/lib/services/mail.service";
import { guardMailbox, storeError } from "../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string; path: string }> };

const renameSchema = z.object({ name: z.string().trim().min(1).max(40) });

const status = (code: string) =>
  code === "exists"
    ? 409
    : code === "not_found"
      ? 404
      : code === "not_empty"
        ? 409
        : 400;

/** Rename a custom folder (its leaf name; it stays where it is). */
export async function PATCH(req: Request, { params }: Params) {
  const { address, path } = await params;
  const g = await guardMailbox(address, "folders-write", 30);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, renameSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  try {
    const res = await renameFolder(
      g.access,
      g.claims,
      decodeURIComponent(path),
      parsed.data.name,
      req,
    );
    if (!res.ok) return fail({ code: res.code }, status(res.code));
    return ok({ folder: res.folder });
  } catch (e) {
    return storeError(e);
  }
}

/** Delete an empty custom folder; a folder with mail in it is refused. */
export async function DELETE(req: Request, { params }: Params) {
  const { address, path } = await params;
  const g = await guardMailbox(address, "folders-write", 30);
  if (!g.ok) return g.res;
  try {
    const res = await deleteFolder(
      g.access,
      g.claims,
      decodeURIComponent(path),
      req,
    );
    if (!res.ok) return fail({ code: res.code }, status(res.code));
    return ok({ deleted: true });
  } catch (e) {
    return storeError(e);
  }
}
