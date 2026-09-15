import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { FileDown, FileText, PenLine } from "lucide-react";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
} from "@/lib/documents/types";
import { getDocument } from "@/lib/services/documents/authored-document.service";
import { listEmployees } from "@/lib/services/hr/employee.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DetailCard } from "@/components/admin/ui/detail";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";
import { ReissueButton } from "@/components/admin/documents/reissue-button";

export const dynamic = "force-dynamic";

const when = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** What has happened to a document: status, versions, the activity trail. */
export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) redirect(`/${locale}/admin/company/documents`);
  const doc = await getDocument(id);
  if (!doc) notFound();
  const editable = doc.status === "draft" || doc.status === "in_review";
  const openComments = (doc.comments ?? []).filter((c) => !c.resolvedAt).length;
  const recipients = doc.recipients ?? [];
  const people = recipients.length
    ? await listEmployees({ includeInactive: true })
    : [];
  const nameOf = (employeeId: unknown) =>
    people.find((p) => String(p._id) === String(employeeId));
  const RECIPIENT_STATUS = {
    pending: { label: "Waiting", tone: "warning" as const },
    acknowledged: { label: "Acknowledged", tone: "success" as const },
    signed: { label: "Signed", tone: "success" as const },
  };

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/admin/company/documents`}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← Documents
      </Link>
      <AdminPageHeader
        title={doc.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{DOCUMENT_TYPE_LABEL[doc.type]}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">{doc.number ?? "No number yet"}</span>
            <StatusBadge tone={statusTone(doc.status)}>
              {DOCUMENT_STATUS_LABEL[doc.status]}
            </StatusBadge>
          </span>
        }
        action={
          <>
            <Button asChild variant="outline" size="sm">
              <a
                href={`/api/admin/company/documents/${id}/pdf`}
                target="_blank"
                rel="noopener"
              >
                <FileText className="size-4" aria-hidden />
                Preview PDF
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={`/api/admin/company/documents/${id}/docx`}>
                <FileDown className="size-4" aria-hidden />
                Word
              </a>
            </Button>
            {(doc.status === "sent" || doc.status === "completed") && (
              <ReissueButton
                documentId={id}
                number={doc.number ?? null}
                pending={
                  recipients.filter((r) => r.status === "pending").length
                }
              />
            )}
            <Button asChild size="sm">
              <Link href={`/${locale}/admin/company/documents/${id}/edit`}>
                <PenLine className="size-4" aria-hidden />
                {editable ? "Edit" : "Open"}
              </Link>
            </Button>
          </>
        }
      />

      {(doc.status === "sent" || doc.status === "completed") && (
        <DetailCard
          title="Recipients"
          description={
            doc.status === "completed"
              ? `Everyone has acted${doc.completedAt ? ` · completed ${when(doc.completedAt)}` : ""}.`
              : `Sent ${doc.sentAt ? when(doc.sentAt) : ""} · waiting on ${recipients.filter((r) => r.status === "pending").length} of ${recipients.length}.`
          }
        >
          {recipients.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No recipients — filed as final when sent.
            </p>
          ) : (
            <ul className="divide-y">
              {recipients.map((r) => {
                const p = nameOf(r.employeeId);
                const s = RECIPIENT_STATUS[r.status];
                return (
                  <li
                    key={String(r.employeeId)}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate font-medium">
                        {p?.name ?? "Former employee"}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {r.role === "sign" ? "Signs" : "Reads"}
                        {r.actedAt ? ` · ${when(r.actedAt)}` : ""}
                        {r.typedName ? ` · typed "${r.typedName}"` : ""}
                      </span>
                    </span>
                    <StatusBadge tone={s.tone} dot={false}>
                      {s.label}
                    </StatusBadge>
                  </li>
                );
              })}
            </ul>
          )}
        </DetailCard>
      )}

      {((doc.reviewers ?? []).length > 0 ||
        (doc.comments ?? []).length > 0) && (
        <DetailCard
          title="Review"
          description={
            openComments
              ? `${openComments} open comment${openComments === 1 ? "" : "s"} — answer and resolve them in the editor.`
              : (doc.comments ?? []).length
                ? "Every comment is resolved."
                : "No comments yet."
          }
        >
          {(doc.reviewers ?? []).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No one was asked to review.
            </p>
          ) : (
            <ul className="divide-y">
              {(doc.reviewers ?? []).map((r) => (
                <li
                  key={String(r.userId)}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="min-w-0">
                    <span className="text-foreground block truncate font-medium">
                      {r.name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      Asked {when(r.invitedAt)}
                      {r.actedAt ? ` · finished ${when(r.actedAt)}` : ""}
                    </span>
                  </span>
                  <StatusBadge
                    tone={r.status === "done" ? "success" : "warning"}
                    dot={false}
                  >
                    {r.status === "done" ? "reviewed" : "asked"}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          )}
        </DetailCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <DetailCard
          title="Versions"
          description="Every filing is an immutable PDF in the vault."
        >
          {doc.versions?.length ? (
            <ul className="divide-border divide-y text-sm">
              {[...doc.versions].reverse().map((v) => (
                <li
                  key={v.n}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium">
                      Version {v.n}{" "}
                      <StatusBadge tone="neutral" dot={false}>
                        {v.label}
                      </StatusBadge>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {when(v.createdAt)}
                      {v.pages
                        ? ` · ${v.pages} page${v.pages === 1 ? "" : "s"}`
                        : ""}
                      {v.note ? ` · ${v.note}` : ""}
                    </div>
                  </div>
                  <a
                    href={`/api/admin/company/documents/${id}/versions/${v.n}`}
                    target="_blank"
                    rel="noopener"
                    className="text-primary shrink-0 text-xs font-medium hover:underline"
                  >
                    Open PDF
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing filed yet.</p>
          )}
        </DetailCard>
        <DetailCard title="Activity">
          <ul className="divide-border divide-y text-sm">
            {[...(doc.activity ?? [])].reverse().map((e, i) => (
              <li key={i} className="py-2">
                <div className="font-medium">{e.action}</div>
                <div className="text-muted-foreground text-xs">
                  {when(e.at)}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </li>
            ))}
          </ul>
        </DetailCard>
      </div>
    </div>
  );
}
