import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/auth/guard";
import { isSuperAdmin } from "@/lib/auth/rbac";
import { accessibleMailboxes } from "@/lib/services/mail.service";
import { EmptyState } from "@/components/admin/ui/empty-state";
import { MailClient } from "@/components/admin/mail/mail-client";
import { MAIL_LAYOUT_COOKIE, parseMailLayout } from "@/lib/mail/layout-cookie";
import { Mail } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * The mailbox inside the admin. Which mailboxes appear is decided by the
 * service (own, shared-and-assigned, any for a super admin); the client only
 * ever asks the API for what it was handed here.
 */
export default async function MailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // The bell deep-links to one message: ?mailbox=&folder=&uid=.
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const wantAddress = one(sp.mailbox)?.toLowerCase();
  const wantFolder = one(sp.folder);
  const wantUid = Number(one(sp.uid));
  setRequestLocale(locale);
  const claims = await requireStaff();
  if (!claims) redirect(`/${locale}?auth=login&next=/${locale}/admin/mail`);

  const mailboxes = await accessibleMailboxes(claims);
  // Pane widths, saved by the client in a cookie so SSR paints them right.
  const defaultLayout = parseMailLayout(
    (await cookies()).get(MAIL_LAYOUT_COOKIE)?.value,
  );

  // No page header: the mailbox frame fills the viewport like a mail app,
  // and the topbar already names the section.
  return (
    <div>
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
          initialAddress={
            mailboxes.find((m) => m.address === wantAddress)?.address ??
            mailboxes[0].address
          }
          initialFolder={wantFolder || undefined}
          initialUid={
            Number.isInteger(wantUid) && wantUid > 0 ? wantUid : undefined
          }
          defaultLayout={defaultLayout}
        />
      )}
    </div>
  );
}
