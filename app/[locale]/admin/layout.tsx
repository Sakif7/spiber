import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin } from "@/lib/auth/rbac";
import { AdminThemeProvider } from "@/components/admin/theme/admin-theme-provider";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { SessionKeepAlive } from "@/components/auth/session-keep-alive";

// Admin depends on the auth cookie; never statically prerender it.
export const dynamic = "force-dynamic";

// Belt-and-suspenders: the proxy + robots.txt already block /admin; this keeps
// any admin URL out of search indexes even if one leaks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Pre-paint, no-flash dark mode for the admin area. Rendered ONLY here (in the
// admin server layout, dynamic) — not in the public locale layout — so a public
// client-side locale switch never re-reconciles a <script> (which would trip
// React 19's "script tag while rendering" warning). It applies the stored
// preference (or system) before the shell paints; the public site stays light.
const ADMIN_THEME_SCRIPT = `(function(){try{var p=localStorage.getItem('spiber-admin-theme');var d=p==='dark'||((p===null||p==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();`;

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
    <>
      <script dangerouslySetInnerHTML={{ __html: ADMIN_THEME_SCRIPT }} />
      <AdminThemeProvider>
        <SessionKeepAlive />
        <AdminShell email={user!.email} role={role}>
          {children}
        </AdminShell>
      </AdminThemeProvider>
    </>
  );
}
