import { setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import {
  listOverview,
  type TemplateListRow,
} from "@/lib/services/pdf-template.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { DataTable } from "@/components/admin/ui/data-table";
import { StatusBadge } from "@/components/admin/ui/status-badge";
import { KIND_LABEL } from "@/lib/pdf/engine/catalogue";

export const dynamic = "force-dynamic";

/**
 * PDF templates — SUPER-ADMIN only (the API enforces it too).
 *
 * One row per document kind: what is published, whether a draft is waiting,
 * and a way into the editor.
 */
export default async function PdfTemplatesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="PDF templates"
          description="How the company's documents are laid out."
        />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Templates are restricted to <strong>super-admins</strong>.
          </p>
        </div>
      </div>
    );
  }

  let rows: TemplateListRow[] = [];
  try {
    rows = await listOverview();
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="PDF templates"
        description="The layout of every proposal, invoice, challan and payslip. Publishing a template changes what is generated from now on; documents already issued keep their layout."
      />
      <DataTable
        rows={rows}
        getRowKey={(r) => r.kind}
        empty="Templates unavailable"
        emptyDescription="The database could not be reached."
        columns={[
          {
            key: "document",
            header: "Document",
            cell: (r) => (
              <Link
                href={`/admin/company/pdf-templates/${r.kind}`}
                className="text-foreground font-medium hover:underline"
              >
                {KIND_LABEL[r.kind]}
              </Link>
            ),
          },
          {
            key: "current",
            header: "Current layout",
            cell: (r) =>
              r.currentVersion === 0 ? (
                <StatusBadge tone="neutral">Built-in</StatusBadge>
              ) : (
                <StatusBadge tone="success">{`v${r.currentVersion}`}</StatusBadge>
              ),
          },
          {
            key: "draft",
            header: "Draft",
            cell: (r) =>
              r.hasDraft ? (
                <span className="inline-flex flex-wrap items-center gap-2">
                  <StatusBadge tone="warning">Draft</StatusBadge>
                  {r.draftUpdatedAt && (
                    <span className="text-muted-foreground text-xs">
                      {new Date(r.draftUpdatedAt).toLocaleString()}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "published",
            header: "Last published",
            cell: (r) =>
              r.lastPublishedAt ? (
                new Date(r.lastPublishedAt).toLocaleString()
              ) : (
                <span className="text-muted-foreground">Never</span>
              ),
          },
          {
            key: "edit",
            header: "",
            align: "right",
            mobile: "actions",
            cell: (r) => (
              <Link
                href={`/admin/company/pdf-templates/${r.kind}`}
                className="text-foreground font-medium hover:underline"
              >
                Edit
              </Link>
            ),
          },
        ]}
      />
    </div>
  );
}
