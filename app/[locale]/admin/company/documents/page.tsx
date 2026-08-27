import { setRequestLocale } from "next-intl/server";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { vaultConfigured } from "@/lib/crypto/vault";
import {
  listCompanyDocuments,
  listCompanyDocumentFolders,
} from "@/lib/repositories/company-documents.repo";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  DocumentsManager,
  type VaultDocRow,
} from "@/components/admin/company/documents-manager";

export const dynamic = "force-dynamic";

/** Company document vault — SUPER-ADMIN only (the API enforces it too). */
export default async function CompanyDocumentsPage({
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
          title="Company documents"
          description="Encrypted file vault."
        />
        <div className="bg-card flex items-start gap-3 rounded-lg p-4 shadow-[var(--shadow-sm)]">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            The vault is restricted to <strong>super-admins</strong>. Ask a
            super-admin if you need a document from it.
          </p>
        </div>
      </div>
    );
  }

  const ready = vaultConfigured();
  let rows: VaultDocRow[] = [];
  let folders: string[] = [];
  if (ready) {
    try {
      const [docs, dirs] = await Promise.all([
        listCompanyDocuments(),
        listCompanyDocumentFolders(),
      ]);
      folders = dirs;
      rows = docs.map((d) => ({
        id: String(d._id),
        title: d.title,
        originalFilename: d.originalFilename,
        contentType: d.contentType,
        size: d.size,
        folder: d.folder ?? null,
        uploadedByEmail: d.uploadedByEmail ?? null,
        createdAt: d.createdAt.toISOString(),
      }));
    } catch {
      rows = [];
    }
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Company documents"
        description="Encrypted vault for internal company files — licenses, contracts, registrations."
      />

      {ready ? (
        <>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
            Encryption at rest is active. Access is super-admin only and every
            view is audited.
          </p>
          <DocumentsManager rows={rows} folders={folders} />
        </>
      ) : (
        <div className="bg-card flex items-start gap-3 rounded-lg p-4 shadow-[var(--shadow-sm)]">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
          <div className="space-y-1 text-sm">
            <p className="font-medium">The vault key is not configured.</p>
            <p className="text-muted-foreground">
              Set <code className="font-mono">COMPANY_VAULT_KEY</code> (64 hex
              characters) in the environment to enable the vault. Generate one
              with{" "}
              <code className="font-mono">
                node -e
                &quot;console.log(require(&apos;crypto&apos;).randomBytes(32).toString(&apos;hex&apos;))&quot;
              </code>
              . Keep a copy in a password manager — losing the key loses every
              stored document.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
