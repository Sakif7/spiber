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

// Pre-paint, no-flash dark mode for the admin area. The script is NOT a React
// <script> element — React 19 warns on ANY reconciled <script> ("script tag
// while rendering"), which fired on every client-side nav into /admin. Instead
// it rides inside a hidden div's dangerouslySetInnerHTML: on a hard load the
// SERVER serializes the raw <script> into the HTML and the browser parser
// executes it pre-paint (exactly as before); on a client-side render, browsers
// never execute innerHTML-inserted scripts (client-rendered React scripts never
// ran either — AdminThemeProvider's effect covers that path), and with no
// script element in the React tree there is nothing for React to warn about.
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
      <div
        hidden
        dangerouslySetInnerHTML={{
          __html: `<script>${ADMIN_THEME_SCRIPT}</script>`,
        }}
      />
      <AdminThemeProvider>
        <SessionKeepAlive />
        <AdminShell email={user!.email} role={role}>
          {children}
        </AdminShell>
      </AdminThemeProvider>
    </>
  );
}
