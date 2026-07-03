import { ok, fail } from "@/lib/http/respond";
import { parseJson } from "@/lib/http/validate";
import { requireAdmin } from "@/lib/auth/guard";
import { chatUpdateSchema } from "@/lib/schemas/chat";
import {
  softDeleteChatConversation,
  updateChatStatus,
} from "@/lib/repositories/chat.repo";
import { writeAudit } from "@/lib/repositories/audit.repo";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const parsed = await parseJson(req, chatUpdateSchema);
  if (!parsed.success) {
    return fail({ code: "invalid_input", details: parsed.issues }, 400);
  }
  if (!parsed.data.status) return fail({ code: "invalid_input" }, 400);

  const updated = await updateChatStatus(id, parsed.data.status);
  if (!updated) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: `chat.status.${parsed.data.status}`,
    entityType: "ChatConversation",
    entityId: id,
    after: { status: parsed.data.status },
  });
  return ok({ status: parsed.data.status });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin();
  if (!admin) return fail({ code: "forbidden" }, 403);
  const { id } = await params;
  const deleted = await softDeleteChatConversation(id);
  if (!deleted) return fail({ code: "not_found" }, 404);
  await writeAudit({
    actorId: admin.sub,
    action: "chat.delete",
    entityType: "ChatConversation",
    entityId: id,
  });
  return ok({ deleted: true });
}
