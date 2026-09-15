import Link from "next/link";
import { setRequestLocale } from "next-intl/server";
import { FileText, ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import {
  DOCUMENT_STATUSES,
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentStatus,
  type DocumentType,
} from "@/lib/documents/types";
import { listDocuments } from "@/lib/services/documents/authored-document.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable, type Column } from "@/components/admin/ui/data-table";
import { ListToolbar } from "@/components/admin/ui/list-toolbar";
import { StatusBadge, statusTone } from "@/components/admin/ui/status-badge";
import { FormPanelButton } from "@/components/admin/ui/form-panel";
import { NewDocumentForm } from "@/components/admin/documents/new-document-form";
import { ImportDocxButton } from "@/components/admin/documents/import-docx-dialog";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof listDocuments>>[number];

const when = (d: Date) =>
  d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function DocumentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="Documents" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Company documents are restricted to <strong>super-admins</strong>.
          </p>
        </div>
      </div>
    );
  }

  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q).slice(0, 120);
  const type = DOCUMENT_TYPES.find((t) => t === one(sp.type));
  const status = DOCUMENT_STATUSES.find((s) => s === one(sp.status));
  const rows = await listDocuments({ q: q || undefined, type, status });
  const filtered = Boolean(q || type || status);

  const columns: Column<Row>[] = [
    {
      key: "title",
      header: "Document",
      mobile: "primary",
      cell: (r) => (
        <div className="min-w-0">
          <Link
            href={`/${locale}/admin/company/documents/${String(r._id)}`}
            className="text-foreground block truncate font-medium hover:underline"
          >
            {r.title}
          </Link>
          <span className="text-muted-foreground font-mono text-xs">
            {r.number ?? "No number yet"}
          </span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Kind",
      cell: (r) => DOCUMENT_TYPE_LABEL[r.type as DocumentType],
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <StatusBadge tone={statusTone(r.status)}>
          {DOCUMENT_STATUS_LABEL[r.status as DocumentStatus]}
        </StatusBadge>
      ),
    },
    {
      key: "versions",
      header: "Versions",
      align: "right",
      cell: (r) => <span className="font-mono text-xs">{r.versions}</span>,
    },
    {
      key: "updated",
      header: "Last change",
      cell: (r) => (
        <span className="text-muted-foreground text-xs">
          {when(r.updatedAt)}
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
          href={`/${locale}/admin/company/documents/${String(r._id)}/${
            r.status === "draft" || r.status === "in_review" ? "edit" : ""
          }`}
          className="text-primary text-sm font-medium hover:underline"
        >
          {r.status === "draft" || r.status === "in_review" ? "Edit" : "Open"}
        </Link>
      ),
    },
  ];

  const newButton = (
    <FormPanelButton
      label="New document"
      title="New document"
      description="A draft on the company letterhead. It gets its number when it is sent."
      width="max-w-[min(30rem,94vw)]"
    >
      <NewDocumentForm />
    </FormPanelButton>
  );

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Documents"
        description="Notices, letters, memos and agreements written on the company letterhead, filed as PDF when sent."
        action={
          <>
            <ImportDocxButton />
            {newButton}
          </>
        }
      />
      <ListToolbar
        search={{ placeholder: "Search title or number…" }}
        filters={[
          {
            param: "type",
            label: "Kind",
            kind: "pills",
            options: DOCUMENT_TYPES.map((t) => ({
              value: t,
              label: DOCUMENT_TYPE_LABEL[t],
            })),
          },
          {
            param: "status",
            label: "Status",
            kind: "pills",
            options: DOCUMENT_STATUSES.map((s) => ({
              value: s,
              label: DOCUMENT_STATUS_LABEL[s],
            })),
          },
        ]}
        total={rows.length}
        countLabel={`${rows.length} document${rows.length === 1 ? "" : "s"}`}
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => String(r._id)}
        empty={
          filtered ? "No documents match these filters." : "No documents yet."
        }
        emptyIcon={FileText}
        emptyDescription={
          filtered
            ? "Try clearing the search or a filter."
            : "Write the first one with the New document button."
        }
        emptyAction={filtered ? undefined : newButton}
      />
    </div>
  );
}
