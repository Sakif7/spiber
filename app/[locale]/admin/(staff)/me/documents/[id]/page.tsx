import Link from "next/link";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ArrowLeft, Download } from "lucide-react";
import { myDocument } from "@/lib/services/documents/document-signing.service";
import { DOCUMENT_TYPE_LABEL } from "@/lib/documents/types";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DetailCard, DetailRow } from "@/components/admin/ui/detail";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { Button } from "@/components/ui/button";
import { AcknowledgeForm } from "@/components/admin/me/acknowledge-form";
import { employeeOrRedirect, day } from "../../_shared";

export const dynamic = "force-dynamic";

const OTHER = {
  pending: { label: "waiting", tone: "warning" as const },
  acknowledged: { label: "acknowledged", tone: "success" as const },
  signed: { label: "signed", tone: "success" as const },
};

/** One document sent to me: read it as filed, then acknowledge or sign. */
export default async function MyDocumentPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, `/admin/me/documents/${id}`);
  const row = await myDocument(session, id);
  if (!row) notFound();
  const pdf = `/api/admin/me/documents/${id}/pdf`;

  return (
    <div className="space-y-4">
      <Link
        href={`/${locale}/admin/me/documents`}
        className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft className="size-4" aria-hidden />
        My documents
      </Link>
      <AdminPageHeader
        title={row.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{DOCUMENT_TYPE_LABEL[row.type]}</span>
            <span aria-hidden>·</span>
            <span className="font-mono">{row.number ?? "—"}</span>
            <span aria-hidden>·</span>
            <span>sent {day(row.sentAt)}</span>
          </span>
        }
        action={
          row.version ? (
            <Button asChild variant="outline" size="sm">
              <a href={`${pdf}?download=1`}>
                <Download className="size-4" aria-hidden />
                Download PDF
              </a>
            </Button>
          ) : undefined
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="bg-muted/30 overflow-hidden rounded-md border">
          {row.version ? (
            <iframe src={pdf} title={row.title} className="h-[75vh] w-full" />
          ) : (
            <p className="text-muted-foreground p-6 text-sm">
              The PDF is not available yet. Try again in a moment.
            </p>
          )}
        </div>
        <div className="grid gap-4">
          {row.me.status === "pending" ? (
            <AcknowledgeForm
              documentId={id}
              role={row.me.role}
              employeeName={session.employee.name}
              hasSignature={Boolean(session.employee.signatureAssetId)}
            />
          ) : (
            <DetailCard
              title={row.me.status === "signed" ? "Signed" : "Acknowledged"}
            >
              <DetailRow label="On">{day(row.me.actedAt)}</DetailRow>
              <DetailRow label="Document">
                {row.status === "completed"
                  ? "Complete — everyone has acted."
                  : "Waiting on others."}
              </DetailRow>
            </DetailCard>
          )}
          {row.others.length > 0 && (
            <DetailCard title="Also sent to">
              <ul className="divide-y">
                {row.others.map((o, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-2 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block truncate">
                        {o.name}
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        {o.role === "sign" ? "signs" : "reads"}
                      </span>
                    </span>
                    <StatusBadge tone={OTHER[o.status].tone} dot={false}>
                      {OTHER[o.status].label}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            </DetailCard>
          )}
        </div>
      </div>
    </div>
  );
}
