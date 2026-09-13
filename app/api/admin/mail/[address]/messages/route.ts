import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { listMessages } from "@/lib/services/mail.service";
import { guardMailbox, storeError } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

const querySchema = z.object({
  folder: z.string().min(1).max(200),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(25),
  q: z.string().trim().max(200).optional(),
  unseen: z.enum(["1", "0"]).optional(),
});

/** `?folder=INBOX&page=1&q=…&unseen=1` — one page of a folder, newest first. */
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
  const { folder, page, pageSize, q, unseen } = parsed.data;
  try {
    return ok(
      await listMessages(g.access, folder, {
        page,
        pageSize,
        query: q,
        unseenOnly: unseen === "1",
      }),
    );
  } catch (e) {
    return storeError(e);
  }
}
