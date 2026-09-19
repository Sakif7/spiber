import { setRequestLocale } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth/current-user";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { mailDomain } from "@/lib/mail/config";
import {
  listMailboxes,
  listStaffUsers,
} from "@/lib/services/mail-admin.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import {
  AddSharedMailboxButton,
  SharedMailboxesManager,
} from "@/components/admin/mail/shared-mailboxes";

export const dynamic = "force-dynamic";

export default async function SharedMailboxesPage({
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
          title="Shared mailboxes"
          description="Who may open which company mailbox."
        />
        <div className="bg-card flex items-start gap-3 rounded-lg border p-4">
          <ShieldAlert className="text-destructive mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Mailbox assignment is restricted to <strong>super-admins</strong>.
          </p>
        </div>
      </div>
    );
  }

  const [mailboxes, staff] = await Promise.all([
    listMailboxes(),
    listStaffUsers(),
  ]);
  const domain = mailDomain();

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Shared mailboxes"
        description="Every company mailbox the admin knows about, and who may open the shared ones. Super admins can open any of them; each such open is audited."
        action={<AddSharedMailboxButton mailDomain={domain} />}
      />
      <SharedMailboxesManager
        rows={mailboxes.map((m) => ({
          id: String(m._id),
          address: m.address,
          hasPassword: Boolean(m.passwordCiphertext),
          kind: m.kind,
          status: m.status,
          ownerUserId: m.ownerUserId ? String(m.ownerUserId) : null,
          assignedUserIds: (m.assignedUserIds ?? []).map(String),
        }))}
        staff={staff}
      />
    </div>
  );
}
