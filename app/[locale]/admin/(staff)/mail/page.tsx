import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/auth/guard";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { accessibleMailboxes } from "@/lib/services/mail.service";
import { AdminPageHeader } from "@/components/admin/ui/page-header";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { MailClient } from "@/components/admin/mail/mail-client";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The mailbox inside the admin. Which mailboxes appear is decided by the
 * service (own, shared-and-assigned, any for a super admin); the client only
 * ever asks the API for what it was handed here.
 */
export default async function MailPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const claims = await requireStaff();
  if (!claims) redirect(`/${locale}?auth=login&next=/${locale}/admin/mail`);

  const mailboxes = await accessibleMailboxes(claims);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        title="Mail"
        description="Company mail, read here with your portal login."
      />
      {mailboxes.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No mailbox yet"
          description={
            isSuperAdmin(claims)
              ? "Add a shared mailbox under Company → Shared mailboxes, or give yourself a business email on your employee record."
              : "Your login is not linked to a mailbox. Ask the office to assign your business email."
          }
        />
      ) : (
        <MailClient
          mailboxes={mailboxes}
          initialAddress={mailboxes[0].address}
        />
      )}
    </div>
  );
}
