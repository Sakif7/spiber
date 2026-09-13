import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { moveMessages, moveMessagesTo } from "@/lib/services/mail.service";
import { guardMailbox, storeError } from "../../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string; uid: string }> };

const bodySchema = z
  .object({
    folder: z.string().min(1).max(200),
    /** By meaning ("trash") … */
    to: z.enum(["trash", "archive", "inbox", "junk"]).optional(),
    /** … or to a folder by path (the "Move to…" menu). */
    toPath: z.string().min(1).max(200).optional(),
  })
  .refine((b) => Boolean(b.to) !== Boolean(b.toPath), {
    message: "exactly one of to / toPath",
  });

/** Move by meaning or by path; trash/junk moves are audited by the service. */
export async function POST(req: Request, { params }: Params) {
  const { address, uid } = await params;
  const g = await guardMailbox(address, "move", 120);
  if (!g.ok) return g.res;
  const parsed = await parseJson(req, bodySchema);
  const n = Number(uid);
  if (!parsed.success || !Number.isInteger(n) || n <= 0) {
    return fail({ code: "invalid_input" }, 400);
  }
  try {
    const res = parsed.data.to
      ? await moveMessages(
          g.access,
          g.claims,
          parsed.data.folder,
          [n],
          parsed.data.to,
          req,
        )
      : await moveMessagesTo(
          g.access,
          g.claims,
          parsed.data.folder,
          [n],
          parsed.data.toPath!,
          req,
        );
    if (!res.ok) return fail({ code: res.code }, 409);
    return ok({ uid: n, folder: res.target });
  } catch (e) {
    return storeError(e);
  }
}
