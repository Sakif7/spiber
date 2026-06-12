import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { AdminThemeProvider } from "@/components/admin/theme/admin-theme-provider";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { SessionKeepAlive } from "@/components/admin/session-keep-alive";

// Admin depends on the auth cookie; never statically prerender it.
// (Theme no-flash handled by next/script in the root layout.)
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  // Defense-in-depth: the proxy also guards /admin, but re-check here.
  const user = await getSessionUser();
  if (!isAdmin(user)) {
    redirect(`/${locale}?auth=login&next=/${locale}/admin`);
  }

  const role = user!.roles.includes("super_admin") ? "super_admin" : "admin";

  return (
    <AdminThemeProvider>
      <SessionKeepAlive />
      <AdminShell email={user!.email} role={role}>
        {children}
      </AdminShell>
    </AdminThemeProvider>
  );
}
