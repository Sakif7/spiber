import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";

/**
 * Every operations and company page lives under this group, so the admin
 * role is checked in exactly one place for all of them. The parent layout
 * admits any staff member (the shell is shared with the employee portal);
 * an employee who is not an admin is sent to their own desk here.
 */
export default async function OpsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    const { locale } = await params;
    redirect(`/${locale}/admin/me`);
  }
  return children;
}
