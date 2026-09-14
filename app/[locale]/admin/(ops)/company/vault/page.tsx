import { setRequestLocale } from "next-intl/server";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { vaultConfigured } from "@/lib/crypto/vault";
import {
  listChildren,
  getTree,
  type FolderNode,
} from "@/lib/services/company-fs.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { FileManager } from "@/components/admin/company/file-manager/file-manager";
import type { ListPayload } from "@/components/admin/company/file-manager/types";

export const dynamic = "force-dynamic";

const EMPTY: ListPayload = {
  folder: null,
  breadcrumb: [],
  folders: [],
  files: [],
  usage: { usedBytes: 0, trashBytes: 0, fileCount: 0, quotaBytes: 0 },
};

/**
 * Company document vault — SUPER-ADMIN only (the API enforces it too).
 *
 * The first folder is rendered on the server so the page arrives complete;
 * everything after that is fetched as JSON by the client, so moving through the
 * tree does not reload the page.
 */
export default async function CompanyVaultPage({
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
        <AdminPageHeader title="Vault" description="Encrypted file vault." />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
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
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  let initial: ListPayload = EMPTY;
  let tree: FolderNode[] = [];
  if (ready) {
    try {
      const [listed, folders] = await Promise.all([
        listChildren({
          folderId: one("folder") ?? null,
          sort: (one("sort") as "name") ?? "name",
          dir: (one("dir") as "asc") ?? "asc",
          q: one("q"),
          recursive: one("recursive") === "1",
          trash: one("trash") === "1",
        }),
        getTree(),
      ]);
      if (listed.ok) initial = listed.data;
      tree = folders;
    } catch {
      initial = EMPTY;
    }
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Vault"
        description="Encrypted vault for internal company files — licences, contracts, registrations."
      />

      {ready ? (
        <>
          <p className="text-muted-foreground flex items-center gap-2 text-xs">
            <ShieldCheck className="size-4 shrink-0 text-emerald-600" />
            Encryption at rest is active. Access is super-admin only and every
            view is audited.
          </p>
          <FileManager initial={initial} initialTree={tree} />
        </>
      ) : (
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
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
