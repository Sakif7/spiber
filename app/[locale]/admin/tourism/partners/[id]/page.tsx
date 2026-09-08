import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { FileText } from "lucide-react";
import { PartnerActions } from "@/components/admin/partner-actions";
import { getPartnerApplicationByIdLean } from "@/lib/repositories/partnerApplications.repo";
import { getSessionUser } from "@/lib/auth/current-user";
import { EditorHeader } from "@/components/admin/ui/form-shell";
import {
  DetailCard,
  DetailLayout,
  DetailProse,
  DetailRow,
} from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";

export const dynamic = "force-dynamic";

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const a = await getPartnerApplicationByIdLean(id).catch(() => null);
  if (!a) notFound();
  const user = await getSessionUser();
  const assignedToMe = Boolean(
    user && a.assignedTo && String(a.assignedTo) === user.sub,
  );

  return (
    <div className="space-y-4">
      <EditorHeader
        backHref="/admin/tourism/partners"
        backLabel="Partners"
        title={a.partnerApplicationNumber}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs">{a.type}</span>
            <StatusBadge>{a.status}</StatusBadge>
            <span className="font-mono text-xs">
              {new Date(a.createdAt).toLocaleString()}
            </span>
          </span>
        }
      />

      <DetailLayout
        aside={
          <PartnerActions
            applicationId={String(a._id)}
            status={a.status}
            currentUserId={user?.sub ?? ""}
            assignedToMe={assignedToMe}
          />
        }
      >
        <DetailCard>
          <DetailRow label="Organization">{a.orgInfo.name}</DetailRow>
          {a.orgInfo.country && (
            <DetailRow label="Country">{a.orgInfo.country}</DetailRow>
          )}
          {a.orgInfo.website && (
            <DetailRow label="Website">{a.orgInfo.website}</DetailRow>
          )}
          <DetailRow label="Contact">{a.contact.name}</DetailRow>
          <DetailRow label="Email">{a.contact.email}</DetailRow>
          <DetailRow label="Phone">{a.contact.phone}</DetailRow>
        </DetailCard>

        {a.orgInfo.description && (
          <DetailCard title="About">
            <DetailProse>{a.orgInfo.description}</DetailProse>
          </DetailCard>
        )}

        <DetailCard title="Documents">
          {(a.documents?.length ?? 0) === 0 ? (
            <p className="text-muted-foreground">No documents uploaded.</p>
          ) : (
            <div className="grid gap-2">
              {a.documents.map((d, i) => (
                <a
                  key={i}
                  href={`/api/media/partner/${String(a._id)}/${i}`}
                  target="_blank"
                  rel="noreferrer"
                  className="border-border text-primary hover:bg-muted flex items-center gap-2.5 rounded-md border px-3 py-2 no-underline"
                >
                  <FileText size={16} aria-hidden />
                  <span className="break-all">{d.name}</span>
                </a>
              ))}
            </div>
          )}
        </DetailCard>

        {a.activity.length > 0 && (
          <DetailCard
            title="Activity"
            bodyClassName="divide-border/60 gap-0 divide-y py-0"
          >
            {a.activity.map((n, i) => (
              <div key={i} className="grid gap-0.5 py-2.5">
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
