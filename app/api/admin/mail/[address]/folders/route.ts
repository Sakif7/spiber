import { ok } from "@/lib/http/respond";
import { listFolders } from "@/lib/services/mail.service";
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
