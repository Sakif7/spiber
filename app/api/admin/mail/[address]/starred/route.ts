import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { listStarred } from "@/lib/services/mail.service";
import { guardMailbox, storeError } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
});

/** `?page=1` — starred messages across every folder but Junk and Trash. */
export async function GET(req: Request, { params }: Params) {
  const { address } = await params;
  const g = await guardMailbox(address, "list");
  if (!g.ok) return g.res;
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }
  try {
    return ok(await listStarred(g.access, parsed.data));
  } catch (e) {
    return storeError(e);
  }
}
