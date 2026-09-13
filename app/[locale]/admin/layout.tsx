import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getSessionUser } from "@/lib/auth/current-user";
import { isAdmin, isEmployee, isStaff, isSuperAdmin } from "@/lib/auth/rbac";
import { getAdminPrefsRaw } from "@/lib/repositories/users.repo";
import { EMPTY_PREFS, sanitizePrefs, type AdminPrefs } from "@/lib/admin/prefs";
import { NAV_BY_ID } from "@/components/admin/shell/nav";
import { AdminThemeProvider } from "@/components/admin/theme/admin-theme-provider";
import { AdminShell } from "@/components/admin/shell/admin-shell";
import { SessionKeepAlive } from "@/components/auth/session-keep-alive";

/**
 * The admin has its own typeface, loaded here rather than in the public layout
 * so no visitor to the marketing site downloads it.
 *
 * Plex was drawn for technical documentation and data: it stays legible at the
 * small sizes a dense table needs, and its Mono companion sets the reference
 * numbers and money columns so figures line up down the column.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-admin",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-admin-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

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

  // Defense-in-depth: the proxy also guards /admin, but re-check here. The
  // shell is shared by admins and employees; the `(ops)` layout underneath
  // re-checks the admin role for every operations/company page, and the
  // `(staff)` pages check for an Employee record.
  const user = await getSessionUser();
  if (!isStaff(user)) {
    redirect(`/${locale}?auth=login&next=/${locale}/admin`);
  }

  const viewer = {
    isSuperAdmin: isSuperAdmin(user),
    isAdmin: isAdmin(user),
    isEmployee: isEmployee(user),
  };
  const role = viewer.isSuperAdmin
    ? "super_admin"
    : viewer.isAdmin
      ? "admin"
      : "employee";

  // Sidebar favourites/recents, server-loaded so the rail renders complete on
  // the first paint. A DB hiccup degrades to an empty (not broken) sidebar.
  let prefs: AdminPrefs = EMPTY_PREFS;
  try {
    prefs = sanitizePrefs(await getAdminPrefsRaw(user!.sub), (id) =>
      NAV_BY_ID.has(id),
    );
  } catch {
    prefs = EMPTY_PREFS;
  }

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
        <AdminShell
          email={user!.email}
          role={role}
          viewer={viewer}
          initialPrefs={prefs}
          fontClassName={`${plexSans.variable} ${plexMono.variable}`}
        >
          {children}
        </AdminShell>
      </AdminThemeProvider>
    </>
  );
}
