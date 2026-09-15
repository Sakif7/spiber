import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { FileSignature } from "lucide-react";
import { myDocuments } from "@/lib/services/documents/document-signing.service";
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPE_LABEL,
} from "@/lib/documents/types";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { employeeOrRedirect, day } from "../_shared";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof myDocuments>>[number];

const MINE = {
  pending: { label: "Waiting for you", tone: "warning" as const },
  acknowledged: { label: "Acknowledged", tone: "success" as const },
  signed: { label: "Signed", tone: "success" as const },
};

/** Notices, letters and agreements sent to me — to sign, or already done. */
export default async function MyDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await employeeOrRedirect(locale, "/admin/me/documents");
  const rows = await myDocuments(session);
  const pending = rows.filter((r) => r.me.status === "pending").length;

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Document",
      mobile: "primary",
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/${locale}/admin/me/documents/${r.id}`}
            className="text-foreground block truncate font-medium hover:underline"
          >
            {r.title}
          </Link>
          <span className="text-muted-foreground font-mono text-xs">
            {r.number ?? "—"}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Kind",
      cell: (r) => DOCUMENT_TYPE_LABEL[r.type],
    },
    {
      key: "sent",
      header: "Sent",
      cell: (r) => (
        <span className="text-muted-foreground text-xs">{day(r.sentAt)}</span>
      ),
    },
    {
      key: "me",
      header: "You",
      cell: (r) =>
        r.superseded ? (
          <StatusBadge tone="neutral" dot={false}>
            {r.me.status === "pending"
              ? "Reissued since"
              : MINE[r.me.status].label}
          </StatusBadge>
        ) : (
          <StatusBadge tone={MINE[r.me.status].tone} dot={false}>
            {r.me.status === "pending"
              ? r.me.role === "sign"
                ? "Your signature is needed"
                : "Please read"
              : MINE[r.me.status].label}
          </StatusBadge>
        ),
    },
    {
      key: "status",
      header: "Document",
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {r.superseded
            ? `v${r.version} · reissued`
            : DOCUMENT_STATUS_LABEL[r.status]}
        </span>
      ),
    },
    {
      key: "open",
      header: "",
      align: "right",
      mobile: "actions",
      cell: (r) => (
        <Link
          href={`/${locale}/admin/me/documents/${r.id}`}
          className="text-primary text-sm font-medium hover:underline"
        >
          {r.me.status === "pending" && !r.superseded ? "Open" : "View"}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="My documents"
        description={
          pending
            ? `${pending} document${pending === 1 ? "" : "s"} waiting for you.`
            : "Nothing is waiting for you."
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        empty="No documents yet."
        emptyIcon={FileSignature}
        emptyDescription="Notices, letters and agreements the office sends you appear here."
      />
    </div>
  );
}
