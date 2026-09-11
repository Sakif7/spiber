import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { templateKindSchema } from "@/lib/schemas/pdf-template";
import { getOverview } from "@/lib/services/pdf-template.service";
import { listAssets } from "@/lib/services/pdf-asset.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  PdfTemplateEditor,
  type EditorInitial,
} from "@/components/admin/pdf-templates/template-editor";

export const dynamic = "force-dynamic";

/** The editor for one document kind's template — SUPER-ADMIN only. */
export default async function PdfTemplateEditorPage({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}) {
  const { locale, kind: rawKind } = await params;
  setRequestLocale(locale);
  const parsed = templateKindSchema.safeParse(rawKind);
  if (!parsed.success) notFound();
  const kind = parsed.data;

  const user = await getSessionUser();
  if (!isSuperAdmin(user)) {
    return (
      <div className="space-y-6">
        <AdminPageHeader title="PDF templates" />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Templates are restricted to <strong>super-admins</strong>.
          </p>
        </div>
      </div>
    );
  }

  const [overview, assets] = await Promise.all([
    getOverview(kind),
    listAssets().catch(() => []),
  ]);
  const initial: EditorInitial = {
    kind,
    current: {
      version: overview.current.version,
      template: overview.current.template,
    },
    draft: overview.draft
      ? {
          template: overview.draft.template,
          updatedAt: new Date(overview.draft.updatedAt).toISOString(),
          baseVersion: overview.draft.baseVersion,
        }
      : null,
    versions: overview.versions.map((v) => ({
      version: v.version,
      publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
      note: v.note,
      baseVersion: v.baseVersion,
    })),
    builtin: overview.builtin,
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      width: a.width,
      height: a.height,
    })),
  };

  return <PdfTemplateEditor initial={initial} />;
}
