import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { createFolder, listFolders } from "@/lib/services/mail.service";
import { guardMailbox, storeError } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const g = await guardMailbox(address, "folders", 120);
  if (!g.ok) return g.res;
  try {
    return ok({ folders: await listFolders(g.access, g.claims, req) });
  } catch (e) {
    return storeError(e);
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  /** Path of the folder to nest under; omitted = top level. */
  parent: z.string().min(1).max(200).optional(),
});

/** Create a folder ("label"); the service checks the name and that it is new. */
export async function POST(req: Request, { params }: Params) {
  const { address } = await params;
  const g = await guardMailbox(address, "folders-write", 30);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, createSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  try {
    const res = await createFolder(
      g.access,
      g.claims,
      parsed.data.name,
      parsed.data.parent,
      req,
    );
    if (!res.ok) {
      return fail(
        { code: res.code },
        res.code === "exists" ? 409 : res.code === "not_found" ? 404 : 400,
      );
    }
    return ok({ folder: res.folder });
  } catch (e) {
    return storeError(e);
  }
}
