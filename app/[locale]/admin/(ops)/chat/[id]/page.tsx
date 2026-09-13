import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { getChatConversationById } from "@/lib/repositories/chat.repo";
import { ChatConversationActions } from "@/components/admin/chat-actions";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export default async function AdminChatDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const c = await getChatConversationById(id).catch(() => null);
  if (!c) notFound();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <EditorHeader
          backHref="/admin/chat"
          backLabel="Chat"
          title="Conversation"
          action={<StatusBadge>{c.status}</StatusBadge>}
        />
        <DetailMeta>
          {c.ref} · {c.locale ?? "en"} ·{" "}
          {new Date(c.updatedAt).toLocaleString()}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <>
            {c.lead && (
              <DetailCard title="Captured lead">
                <DetailRow label="Name">{c.lead.name}</DetailRow>
                <DetailRow label="Email">{c.lead.email}</DetailRow>
                {c.lead.phone && (
                  <DetailRow label="Phone">{c.lead.phone}</DetailRow>
                )}
                {c.lead.message && <DetailProse>{c.lead.message}</DetailProse>}
                <DetailRow label="Reference" mono>
                  {c.lead.leadNumber}
                </DetailRow>
              </DetailCard>
            )}

            <ChatConversationActions
              conversationId={String(c._id)}
              status={c.status}
            />
          </>
        }
      >
        {/* Transcript */}
        <DetailCard title={`Transcript (${c.messages?.length ?? 0})`}>
          {(c.messages ?? []).length === 0 && (
            <span className="text-muted-foreground">No messages recorded.</span>
          )}
          {(c.messages ?? []).map((m, i) => (
            <div
              key={i}
              className={cn(
                "flex flex-col gap-0.5",
                m.role === "user" ? "items-end" : "items-start",
              )}
            >
              <div
                className={cn(
                  "max-w-[88%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground",
                )}
              >
                {m.text}
              </div>
              <span className="text-muted-foreground text-admin-2xs">
                {m.role === "user" ? "Visitor" : "Bot"}
                {m.intent ? ` · ${m.intent}` : ""}
                {m.at ? ` · ${new Date(m.at).toLocaleTimeString()}` : ""}
              </span>
            </div>
          ))}
        </DetailCard>
      </DetailLayout>
    </div>
  );
}
