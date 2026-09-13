import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { setFlags } from "@/lib/services/mail.service";
import { forgetMailFeed } from "@/lib/services/mail-notify.service";
import { guardMailbox, storeError } from "../../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string; uid: string }> };

const bodySchema = z.object({
  folder: z.string().min(1).max(200),
  seen: z.boolean().optional(),
  flagged: z.boolean().optional(),
});

export async function POST(req: Request, { params }: Params) {
  const { address, uid } = await params;
  const g = await guardMailbox(address, "flags");
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, bodySchema);
  const n = Number(uid);
  if (!parsed.success || !Number.isInteger(n) || n <= 0) {
    return fail({ code: "invalid_input" }, 400);
  }
  const { folder, ...patch } = parsed.data;
  try {
    await setFlags(g.access, folder, [n], patch);
    if (patch.seen !== undefined && !g.access.elevated) {
      forgetMailFeed(g.claims.sub);
    }
    return ok({ uid: n, ...patch });
  } catch (e) {
    return storeError(e);
  }
}
