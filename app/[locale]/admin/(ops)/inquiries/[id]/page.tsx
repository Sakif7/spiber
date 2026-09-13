import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { InquiryActions } from "@/components/admin/inquiry-actions";
import { getInquiryByIdLean } from "@/lib/repositories/inquiries.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailMeta,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminInquiryDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const q = await getInquiryByIdLean(id).catch(() => null);
  if (!q) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && q.assignedTo && String(q.assignedTo) === user.sub,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <EditorHeader
          backHref="/admin/inquiries"
          backLabel="Inquiries"
          title={q.subject || q.inquiryNumber}
          action={<StatusBadge>{q.status}</StatusBadge>}
        />
        <DetailMeta>
          {q.inquiryNumber} · {q.division}
        </DetailMeta>
      </div>

      <DetailLayout
        aside={
          <InquiryActions
            inquiryId={String(q._id)}
            status={q.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Name">{q.name}</DetailRow>
          <DetailRow label="Email">{q.email}</DetailRow>
          {q.phone && <DetailRow label="Phone">{q.phone}</DetailRow>}
          {q.company && <DetailRow label="Company">{q.company}</DetailRow>}
          {q.budgetRange && (
            <DetailRow label="Budget">{q.budgetRange}</DetailRow>
          )}
          {q.linkedEntity && (
            <DetailRow label="Linked" mono>
              {`${q.linkedEntity.kind}: ${q.linkedEntity.id}`}
            </DetailRow>
          )}
        </DetailCard>

        <DetailCard title="Message">
          <DetailProse>{q.message}</DetailProse>
        </DetailCard>

        {q.notes.length > 0 && (
          <DetailCard title="Notes">
            {q.notes.map((n, i) => (
              <div key={i} className="grid gap-0.5">
                <span className="text-foreground">{n.body}</span>
                <span className="text-muted-foreground text-xs">
                  {new Date(n.at).toLocaleString()}
                </span>
              </div>
            ))}
          </DetailCard>
        )}
      </DetailLayout>
    </div>
  );
}
