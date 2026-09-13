import { z } from "zod";
import { ok, fail } from "@/lib/http/respond";
import { sendMessage } from "@/lib/services/mail.service";
import { parseRecipients } from "@/lib/mail/address";
import { guardMailbox, storeError } from "../../_guard";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ address: string }> };

const MAX_FILES = 10;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const fieldsSchema = z.object({
  to: z.string().max(4000),
  cc: z.string().max(4000).default(""),
  bcc: z.string().max(4000).default(""),
  subject: z.string().max(500).default(""),
  text: z.string().max(200_000).default(""),
  /** Rich text from the composer; the service sanitises it. */
  html: z.string().max(400_000).default(""),
  replyFolder: z.string().max(200).optional(),
  replyUid: z.coerce.number().int().positive().optional(),
  forwardFolder: z.string().max(200).optional(),
  forwardUid: z.coerce.number().int().positive().optional(),
  /** Comma-separated attachment indexes of the forwarded original. */
  forwardAttachments: z.string().max(200).default(""),
});

/** Multipart: the fields above plus `files` (up to 10 × 15 MB). */
export async function POST(req: Request, { params }: Params) {
  const { address } = await params;
  const g = await guardMailbox(address, "send", 30);
  if (!g.ok) return g.res;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(
      { code: "invalid_input", message: "multipart form expected" },
      400,
    );
  }
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;
  const parsed = fieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.error.issues }, 400);
  }
  const f = parsed.data;

  const to = parseRecipients(f.to);
  const cc = parseRecipients(f.cc);
  const bcc = parseRecipients(f.bcc);
  for (const r of [to, cc, bcc]) {
    if (!r.ok) {
      return fail(
        {
          code: "bad_recipient",
          message: `“${r.bad}” is not an email address.`,
        },
        400,
      );
    }
  }
  if (
    to.ok &&
    cc.ok &&
    bcc.ok &&
    to.list.length + cc.list.length + bcc.list.length === 0
  ) {
    return fail(
      { code: "no_recipients", message: "Add at least one recipient." },
      400,
    );
  }

  const files = form
    .getAll("files")
    .filter((v): v is File => v instanceof File);
  if (files.length > MAX_FILES) {
    return fail(
      { code: "too_many_files", message: `At most ${MAX_FILES} attachments.` },
      400,
    );
  }
  const attachments = [];
  for (const file of files) {
    if (file.size > MAX_FILE_BYTES) {
      return fail(
        { code: "file_too_large", message: `${file.name} is over 15 MB.` },
        413,
      );
    }
    attachments.push({
      filename:
        file.name.replace(/[\r\n"]/g, "_").slice(0, 200) || "attachment",
      contentType: file.type || "application/octet-stream",
      content: Buffer.from(await file.arrayBuffer()),
    });
  }

  try {
    const res = await sendMessage(
      g.access,
      g.claims,
      {
        to: to.ok ? to.list : [],
        cc: cc.ok ? cc.list : [],
        bcc: bcc.ok ? bcc.list : [],
        subject: f.subject,
        text: f.text,
        html: f.html || null,
        attachments,
        inReplyTo:
          f.replyFolder && f.replyUid
            ? { folder: f.replyFolder, uid: f.replyUid }
            : null,
        forwardOf:
          f.forwardFolder && f.forwardUid
            ? {
                folder: f.forwardFolder,
                uid: f.forwardUid,
                attachmentIndexes: f.forwardAttachments
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => Number.isInteger(n) && n >= 0),
              }
            : null,
      },
      req,
    );
    if (!res.ok) {
      const status =
        res.code === "transport_not_configured"
          ? 503
          : res.code === "transport_failed"
            ? 502
            : res.code === "too_large"
              ? 413
              : 400;
      return fail({ code: res.code, message: res.detail }, status);
    }
    return ok(res.data);
  } catch (e) {
    return storeError(e);
  }
}
