import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { getMessage } from "@/lib/services/mail.service";
import { forgetMailFeed } from "@/lib/services/mail-notify.service";
import { guardMailbox, storeError } from "../../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string; uid: string }> };

const querySchema = z.object({
  folder: z.string().min(1).max(200),
  images: z.enum(["1", "0"]).optional(),
});

/** One message, body sanitised, marked read. `images=1` lets remote images through. */
export async function GET(req: Request, { params }: Params) {
  const { address, uid } = await params;
  const g = await guardMailbox(address, "read");
  if (!g.ok) return g.res;
  const parsed = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams),
  );
  const n = Number(uid);
  if (!parsed.success || !Number.isInteger(n) || n <= 0) {
    return fail({ code: "invalid_input" }, 400);
  }
  try {
    const message = await getMessage(g.access, parsed.data.folder, n, {
      allowRemoteImages: parsed.data.images === "1",
    });
    if (!message) return fail({ code: "not_found" }, 404);
    // Reading marks read: let the bell recount on its next poll.
    if (!g.access.elevated) forgetMailFeed(g.claims.sub);
    return ok({ message });
  } catch (e) {
    return storeError(e);
  }
}
