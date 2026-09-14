import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { requireStaff } from "@/lib/auth/guard";
import { NotificationsPage } from "@/components/admin/shell/notifications-page";

export const dynamic = "force-dynamic";

/** "View all notifications" from the bell — every staff member has one. */
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const claims = await requireStaff();
  if (!claims) {
    redirect(`/${locale}?auth=login&next=/${locale}/admin/notifications`);
  }
  return <NotificationsPage />;
}
